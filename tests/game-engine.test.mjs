import assert from "node:assert/strict";
import test from "node:test";
import {
  cardCost,
  createGame,
  endTurn,
  findScoringCells,
  placeFigure,
  playCard,
  rechangeRandomCard,
  settleClear,
  settleThaw,
} from "../app/game/engine.ts";
import { applyNetworkIntent } from "../app/game/photon.ts";
import {
  chooseCardReward,
  createRoguelikeGame,
  createRoguelikeRun,
  getRoguelikeStage,
  resolveRoguelikeResult,
} from "../app/game/roguelike.ts";

test("finds a horizontal line of three", () => {
  const board = [1, 1, 1, null, 2, null, 2, null, null];
  assert.deepEqual(findScoringCells(board, 3, 1), [0, 1, 2]);
});

test("scores unique cells when two lines cross", () => {
  const board = [
    null, 1, null,
    1, 1, 1,
    null, 1, null,
  ];
  assert.deepEqual(findScoringCells(board, 3, 1).sort(), [1, 3, 4, 5, 7]);
});

test("a frozen cell breaks a scoring line", () => {
  const board = [1, 1, 1, null, null, null, null, null, null];
  assert.deepEqual(
    findScoringCells(board, 3, 1, { 1: { owner: 1, turns: 2 } }),
    [],
  );
});

test("clears a completed line without ending the turn", () => {
  let game = createGame();
  game = placeFigure(game, 0);
  game = placeFigure(game, 1);
  game = placeFigure(game, 2);

  assert.equal(game.phase, "clearing");
  assert.equal(game.lastGain, 3);

  game = settleClear(game);
  assert.equal(game.scores[1], 3);
  assert.deepEqual(game.board.slice(0, 3), [null, null, null]);
  assert.equal(game.turn, 1);
});

test("draws two cards and restores mana when the turn ends", () => {
  let game = createGame();
  assert.equal(game.hands[1].length, 2);
  assert.equal(game.hands[2].length, 0);

  const firstCard = game.hands[1][0];
  game = playCard(game, firstCard.id, 0);
  assert.equal(game.hands[1].length, 1);
  assert.equal(game.turn, 1);

  game = endTurn({ ...game, mana: 0 });
  assert.equal(game.turn, 2);
  assert.equal(game.mana, 3);
  assert.equal(game.hands[2].length, 2);
});

test("base placement cards gain one cost after every placement until the turn ends", () => {
  let game = createGame();
  const first = game.hands[1].find((card) => card.kind === "place");
  assert.ok(first);
  assert.equal(cardCost(game, first), 0);

  game = playCard(game, first.id, 0);
  const nextBase = [...game.hands[1], ...game.decks[1]].find(
    (card) => card.kind === "place" && card.id !== first.id,
  );
  assert.ok(nextBase);
  assert.equal(cardCost(game, nextBase), 1);

  game = endTurn(game);
  assert.equal(game.basePlacementCosts[1], 0);
});

test("spends mana and freezes three cells with the freeze card", () => {
  let game = createGame();
  game = {
    ...game,
    hands: {
      ...game.hands,
      1: [{ id: "1-freeze-test", kind: "freeze-3" }],
    },
  };

  game = playCard(game, "1-freeze-test");
  assert.equal(game.mana, 1);
  assert.equal(Object.keys(game.frozen).length, 3);
  assert.equal(game.hands[1].length, 0);
});

test("keeps an activated random-figure effect for three turns", () => {
  let game = createGame();
  game = {
    ...game,
    hands: {
      ...game.hands,
      1: [{ id: "1-effect-test", kind: "random-effect" }],
    },
  };

  game = playCard(game, "1-effect-test");
  assert.equal(game.randomFigureTurns[1], 3);
  assert.equal(game.mana, 2);
});

test("thawed ice becomes the owner's figure at the start of their turn", () => {
  let game = createGame();
  game = {
    ...game,
    frozen: { 0: { owner: 2, turns: 1 } },
  };

  game = endTurn(game);
  assert.equal(game.turn, 2);
  assert.equal(game.phase, "thawing");
  assert.deepEqual(game.thawingCells, [0]);
  assert.equal(game.board[0], 2);
  assert.equal(game.frozen[0], undefined);

  game = settleThaw(game);
  assert.equal(game.phase, "playing");
  assert.deepEqual(game.thawingCells, []);
});

test("ice encirclement only accepts an ally and freezes orthogonal neighbours", () => {
  let game = createGame();
  game = {
    ...game,
    board: [null, null, null, null, 1, null, null, null, null],
    hands: {
      ...game.hands,
      1: [{ id: "1-encircle-test", kind: "ice-encirclement" }],
    },
  };

  const rejected = playCard(game, "1-encircle-test", 0);
  assert.equal(rejected, game);

  game = playCard(game, "1-encircle-test", 4);
  assert.deepEqual(
    Object.keys(game.frozen).map(Number).sort((a, b) => a - b),
    [1, 3, 5, 7],
  );
  assert.equal(game.mana, 1);
});

test("a card can be replaced only once during the turn", () => {
  let game = createGame();
  const originalIds = game.hands[1].map((card) => card.id);
  game = rechangeRandomCard(game);

  assert.equal(game.hands[1].length, 2);
  assert.equal(game.rechangerAvailable[1], false);
  assert.notDeepEqual(
    game.hands[1].map((card) => card.id),
    originalIds,
  );

  const unchanged = rechangeRandomCard(game);
  assert.equal(unchanged, game);
});

test("freeze all mana converts every remaining point into two ice", () => {
  let game = createGame();
  game = {
    ...game,
    maxMana: 5,
    mana: 5,
    hands: {
      ...game.hands,
      1: [{ id: "1-freeze-mana-test", kind: "freeze-all-mana" }],
    },
  };

  game = playCard(game, "1-freeze-mana-test");
  assert.equal(game.mana, 0);
  assert.equal(Object.keys(game.frozen).length, 4);
});

test("builds a custom deck and keeps five copies of the base figure card", () => {
  const game = createGame(["place", "freeze-cell", "shortage", "full-house", "place-more"]);
  const allPlayerOneCards = [...game.hands[1], ...game.decks[1]];

  assert.equal(allPlayerOneCards.length, 9);
  assert.equal(
    allPlayerOneCards.filter((card) => card.kind === "place").length,
    5,
  );
  assert.deepEqual(game.deckKinds, [
    "place",
    "freeze-cell",
    "shortage",
    "full-house",
    "place-more",
  ]);
});

test("roguelike starts with Unity stage rules and ten base cards", () => {
  const run = createRoguelikeRun();
  const game = createRoguelikeGame(run);

  assert.equal(game.size, 3);
  assert.equal(game.scoreToWin, 3);
  assert.equal(game.maxMana, 0);
  assert.equal(game.singleRound, true);
  assert.equal([...game.hands[1], ...game.decks[1]].length, 10);
  assert.ok([...game.hands[1], ...game.decks[1]].every((card) => card.kind === "place"));
});

test("first roguelike victory grants one mana and a mandatory card reward", () => {
  const run = resolveRoguelikeResult(createRoguelikeRun(), 1);

  assert.equal(run.victories, 1);
  assert.equal(run.stageIndex, 1);
  assert.equal(run.maximumMana, 1);
  assert.equal(run.status, "reward");
  assert.equal(run.rewardChoices.length, 3);

  const rewarded = chooseCardReward(run, run.rewardChoices[0]);
  assert.equal(rewarded.status, "playing");
  assert.equal(rewarded.deck.filter((kind) => kind === "place").length, 9);
});

test("roguelike stage progression matches the configured Unity values", () => {
  assert.deepEqual(getRoguelikeStage(3), {
    boardSize: 4,
    scoreToWin: 15,
    smartFigures: 2,
    randomFigures: 1,
  });
  assert.deepEqual(getRoguelikeStage(6), {
    boardSize: 6,
    scoreToWin: 20,
    smartFigures: 0,
    randomFigures: 5,
  });
});

test("accepts gameplay intents only from the active remote player", () => {
  let game = createGame();
  const beforeRemoteTurn = applyNetworkIntent(
    game,
    { type: "end-turn" },
    2,
  );
  assert.equal(beforeRemoteTurn, game);

  game = endTurn(game);
  assert.equal(game.turn, 2);

  const afterRemoteTurn = applyNetworkIntent(
    game,
    { type: "end-turn" },
    2,
  );
  assert.equal(afterRemoteTurn.turn, 1);

  const rejectedHostIntent = applyNetworkIntent(
    game,
    { type: "end-turn" },
    1,
  );
  assert.equal(rejectedHostIntent, game);
});

test("host applies a valid remote card play to the authoritative state", () => {
  let game = createGame();
  game = {
    ...game,
    turn: 2,
    hands: {
      ...game.hands,
      2: [{ id: "2-network-place", kind: "place" }],
    },
  };

  const next = applyNetworkIntent(
    game,
    { type: "play", cardId: "2-network-place", targetIndex: 4 },
    2,
  );

  assert.equal(next.board[4], 2);
  assert.equal(next.hands[2].length, 0);
  assert.equal(next.mana, game.mana);
});
