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
import { isPhotonConfigured, PHOTON_GAME_CONFIG } from "../app/game/photon-config.ts";
import { chooseRandomTarget } from "../app/game/bot-player.ts";
import { findClosestCardTarget, resolveCardDrop } from "../app/game/card-interaction.ts";
import { CARD_MECHANICS, mechanicsForCard } from "../app/game/card-mechanics.ts";
import { CARD_DEFINITIONS } from "../app/game/cards.ts";
import { cardRevealProfile } from "../app/game/card-reveal-profile.ts";
import { cardTransferSlot } from "../app/game/card-transfer-layout.ts";
import { cardPackCost, drawCardPack } from "../app/game/card-purchase.ts";
import { grantCoins, starterCollectionProgress, TEST_COIN_GRANT } from "../app/game/collection-progress.ts";
import { canTargetCard, getGamePlayers, getRoundResult } from "../app/game/game-presentation.ts";
import {
  chooseCardReward,
  createRoguelikeGame,
  createRoguelikeRun,
  getRoguelikeStage,
  resolveRoguelikeResult,
} from "../app/game/roguelike.ts";

test("describes mechanics for every card kind", () => {
  assert.deepEqual(Object.keys(CARD_MECHANICS).sort(), Object.keys(CARD_DEFINITIONS).sort());
  assert.ok(mechanicsForCard("freeze-cell").includes("ice"));
  assert.ok(mechanicsForCard("place-draw").includes("draw"));
});

test("uses one shared Photon region for global matchmaking", () => {
  assert.equal(isPhotonConfigured(PHOTON_GAME_CONFIG), true);
  assert.equal(PHOTON_GAME_CONFIG.region, "EU");
  assert.equal(PHOTON_GAME_CONFIG.appVersion, "tttp-web-1");
});

test("builds reveal profiles from rarity and mechanics", () => {
  const profiles = Object.keys(CARD_DEFINITIONS).map((kind) => cardRevealProfile(kind));
  assert.ok(profiles.every((profile) => profile.durationMs >= 5000 && profile.durationMs <= 10000));
  assert.equal(cardRevealProfile("freeze-cell").accent, "ice");
  assert.equal(cardRevealProfile("destroy-freeze").accent, "ice");
  assert.equal(cardRevealProfile("place-more").accent, "white");
  assert.equal(cardRevealProfile("place-more").accentRgb, "255 255 255");
  assert.equal(cardRevealProfile("place-more").rarity, "legendary");
  assert.ok(cardRevealProfile("place-more").scale > cardRevealProfile("place").scale);
  assert.ok(profiles.every((profile) => profile.cues.at(-1)?.sound === "light"));
});

test("scatters purchased cards horizontally in alternating directions", () => {
  const slots = Array.from({ length: 10 }, (_, index) => cardTransferSlot(index));
  assert.deepEqual(slots.map((slot) => slot.direction), [-1, 1, -1, 1, -1, 1, -1, 1, -1, 1]);
  assert.ok(slots.every((slot) => slot.insetPx >= 0));
});

test("draws unique card packs of supported sizes", () => {
  [1, 3, 5, 7, 10].forEach((size) => {
    const pack = drawCardPack(Object.keys(CARD_DEFINITIONS), size, () => 0.99);
    assert.equal(pack.length, size);
    assert.equal(new Set(pack).size, size);
    assert.equal(cardPackCost(size), size * 50);
  });
  assert.equal(drawCardPack(["place", "freeze-cell"], 5).length, 2);
  assert.equal(cardPackCost(Number.NaN), 0);
});

test("provides deterministic collection testing controls", () => {
  assert.equal(grantCoins(120), 120 + TEST_COIN_GRANT);
  assert.equal(grantCoins(Number.NaN), TEST_COIN_GRANT);
  const progress = starterCollectionProgress();
  assert.deepEqual(progress.selectedKinds, progress.unlockedKinds);
  assert.ok(progress.selectedKinds.length >= 5);
});

test("resolves card drops through target strategies", () => {
  assert.deepEqual(resolveCardDrop("none", { overField: true, hoverIndex: null }), { type: "play" });
  assert.deepEqual(resolveCardDrop("empty", { overField: true, hoverIndex: 4 }), { type: "play", targetIndex: 4 });
  assert.deepEqual(resolveCardDrop("ally", { overField: false, hoverIndex: 4 }), { type: "cancel" });
});

test("resolves board gaps to the closest valid card target", () => {
  const areas = [
    { index: 0, left: 0, right: 40, top: 0, bottom: 40 },
    { index: 1, left: 50, right: 90, top: 0, bottom: 40 },
  ];
  assert.equal(findClosestCardTarget(47, 20, areas), 1);
  assert.equal(findClosestCardTarget(45, 20, areas), 0);
  assert.equal(findClosestCardTarget(45, 20, [areas[1]]), 1);
  assert.equal(findClosestCardTarget(45, 20, []), null);
});

test("chooses random targets through an injected random source", () => {
  const game = { ...createGame(), board: [1, null, null, 2, 1, 2, 1, 2, 1] };
  assert.equal(chooseRandomTarget(game, () => 0), 1);
  assert.equal(chooseRandomTarget(game, () => 0.99), 2);
});

test("derives player placement without UI state", () => {
  assert.deepEqual(getGamePlayers("local", 2, null), {
    bottomPlayer: 2,
    displayedPlayer: 2,
    topPlayer: 1,
  });
  assert.deepEqual(getGamePlayers("online", 1, 2), {
    bottomPlayer: 2,
    displayedPlayer: 2,
    topPlayer: 1,
  });
});

test("keeps the round result separate from a drawn match result", () => {
  const game = {
    ...createGame(),
    phase: "game-over",
    completedRounds: 3,
    roundWinner: 2,
    gameWinner: null,
    roundWins: { 1: 1, 2: 1 },
  };

  assert.deepEqual(getRoundResult(game, 1, (key) => key), {
    headline: "roundDefeat",
    tone: "defeat",
    winner: 2,
  });
});

test("validates card targets outside the component", () => {
  const game = createGame();
  const card = game.hands[1].find((item) => item.kind === "place");
  assert.ok(card);
  assert.equal(canTargetCard(game, card.id, 0, true), true);
  assert.equal(canTargetCard({ ...game, board: [2, ...game.board.slice(1)] }, card.id, 0, true), false);
  assert.equal(canTargetCard(game, card.id, 0, false), false);
});

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

test("a full board is won by the player with more remaining health", () => {
  const game = placeFigure({
    ...createGame(),
    board: [1, 2, 1, 1, 2, 2, 2, 1, null],
    scores: { 1: 6, 2: 3 },
  }, 8);

  assert.equal(game.phase, "round-over");
  assert.equal(game.roundWinner, 1);
  assert.equal(game.roundWins[1], 1);
});

test("a full board is a draw when both players have equal health", () => {
  const game = placeFigure({
    ...createGame(),
    board: [1, 2, 1, 1, 2, 2, 2, 1, null],
    scores: { 1: 4, 2: 4 },
  }, 8);

  assert.equal(game.phase, "round-over");
  assert.equal(game.roundWinner, null);
  assert.deepEqual(game.roundWins, { 1: 0, 2: 0 });
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

test("duplicate cards share their increasing Unity mana cost", () => {
  let game = createGame();
  game = {
    ...game,
    hands: {
      ...game.hands,
      1: [
        { id: "1-shortage-a", kind: "shortage" },
        { id: "1-shortage-b", kind: "shortage" },
      ],
    },
  };
  assert.equal(cardCost(game, game.hands[1][1]), 1);
  game = playCard(game, "1-shortage-a");
  const duplicate = game.hands[1].find((card) => card.id === "1-shortage-b");
  assert.ok(duplicate);
  assert.equal(cardCost(game, duplicate), 2);
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

test("all Unity field cards spend the configured mana and resolve their exact effects", () => {
  const originalRandom = Math.random;
  Math.random = () => 0;
  try {
    let game = createGame();
    game = {
      ...game,
      mana: 5,
      hands: { ...game.hands, 1: [{ id: "1-place-five", kind: "place-5" }] },
    };
    game = playCard(game, "1-place-five");
    assert.equal(game.mana, 1);
    assert.equal(game.board.filter(Boolean).length, 2);
    assert.equal(game.scores[1], 3);

    game = createGame();
    game = {
      ...game,
      mana: 5,
      hands: { ...game.hands, 1: [{ id: "1-freeze-all", kind: "freeze-all-mana" }] },
    };
    game = playCard(game, "1-freeze-all");
    assert.equal(game.mana, 0);
    assert.equal(Object.keys(game.frozen).length, 4);

    game = createGame();
    game = {
      ...game,
      mana: 3,
      hands: { ...game.hands, 1: [{ id: "1-place-more", kind: "place-more" }] },
    };
    game = playCard(game, "1-place-more");
    assert.equal(game.mana, 0);
    assert.equal(game.phase, "clearing");
    assert.equal(game.clearingCells.length, 3);
  } finally {
    Math.random = originalRandom;
  }
});

test("Unity ice cards preserve ownership, duration and neighbour rules", () => {
  const originalRandom = Math.random;
  Math.random = () => 0;
  try {
    let game = createGame();
    game = {
      ...game,
      board: [1, 1, 1, 1, 1, 1, 1, null, null],
      hands: { ...game.hands, 1: [{ id: "1-freeze-six", kind: "freeze-6-figures" }] },
    };
    game = playCard(game, "1-freeze-six");
    assert.equal(game.board.filter((cell) => cell === 1).length, 1);
    assert.equal(Object.keys(game.frozen).length, 6);
    assert.ok(Object.values(game.frozen).every((ice) => ice.owner === 1 && ice.turns === 2));

    game = createGame();
    game = {
      ...game,
      board: [null, null, null, null, 1, null, null, null, null],
      hands: { ...game.hands, 1: [{ id: "1-surround", kind: "ice-encirclement" }] },
    };
    game = playCard(game, "1-surround", 4);
    assert.deepEqual(Object.keys(game.frozen).map(Number).sort(), [1, 3, 5, 7]);

    game = {
      ...createGame(),
      board: [null, null, null, null, 1, null, null, null, null],
      frozen: { 1: { owner: 2, turns: 2 }, 3: { owner: 2, turns: 2 }, 0: { owner: 2, turns: 2 } },
      hands: { 1: [{ id: "1-break-near", kind: "surrounded-by-ice" }], 2: [] },
    };
    game = playCard(game, "1-break-near", 4);
    assert.equal(game.phase, "thawing");
    assert.deepEqual(game.thawingCells.sort(), [1, 3]);
    assert.equal(game.frozen[0].owner, 2);
  } finally {
    Math.random = originalRandom;
  }
});

test("Unity draw and timed-effect cards match their turn counts", () => {
  let game = createGame();
  game = {
    ...game,
    hands: { ...game.hands, 1: [{ id: "1-full", kind: "full-house" }] },
  };
  game = playCard(game, "1-full");
  assert.equal(game.hands[1].length, 5);

  game = {
    ...createGame(),
    hands: { 1: [{ id: "1-short", kind: "shortage" }], 2: [] },
  };
  game = playCard(game, "1-short");
  assert.equal(game.hands[1].length, 2);

  game = {
    ...createGame(),
    hands: { 1: [{ id: "1-ice-effect", kind: "freeze-effect" }], 2: [] },
  };
  game = playCard(game, "1-ice-effect");
  assert.equal(game.randomFreezeTurns[1], 3);
  game = endTurn(game);
  game = endTurn(game);
  assert.equal(game.randomFreezeTurns[1], 2);
  assert.equal(Object.keys(game.frozen).length, 1);
});

test("destroy and spread ice cards match the Unity limits", () => {
  const originalRandom = Math.random;
  Math.random = () => 0;
  try {
    const frozen = Object.fromEntries(Array.from({ length: 8 }, (_, index) => [index, { owner: 2, turns: 2 }]));
    let game = {
      ...createGame(),
      frozen,
      hands: { 1: [{ id: "1-destroy", kind: "destroy-freeze" }], 2: [] },
    };
    game = playCard(game, "1-destroy");
    assert.equal(game.thawingCells.length, 6);
    assert.equal(Object.keys(game.frozen).length, 2);

    game = {
      ...createGame(),
      frozen: { 4: { owner: 1, turns: 2 } },
      hands: { 1: [{ id: "1-spread", kind: "place-around-freeze" }], 2: [] },
    };
    game = playCard(game, "1-spread");
    assert.equal(Object.keys(game.frozen).length, 2);
  } finally {
    Math.random = originalRandom;
  }
});
