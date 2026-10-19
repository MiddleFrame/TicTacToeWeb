import assert from "node:assert/strict";
import test from "node:test";
import { cardCost, cardCostForPlayer, createGame, endTurn, findScoringCells, placeFigure, playCard, settleClear, settleThaw, startNextRound } from "../../app/game/engine.ts";

import { CARD_DEFINITIONS } from "../../app/game/cards.ts";

test("keeps displayed card costs tied to the hand owner", () => {
  const initial = createGame();
  const card = initial.hands[1].find((item) => item.kind === "place");
  assert.ok(card);
  const game = {
    ...initial,
    turn: 2,
    basePlacementCosts: { 1: 2, 2: 0 },
  };

  assert.equal(cardCostForPlayer(game, card, 1), CARD_DEFINITIONS.place.cost + 2);
  assert.equal(cardCost(game, card), CARD_DEFINITIONS.place.cost);
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

test("normal matches increase the round target from 10 to 15 to 20", () => {
  let game = createGame();
  assert.equal(game.scoreToWin, 10);

  game = startNextRound({ ...game, phase: "round-over", completedRounds: 1 });
  assert.equal(game.scoreToWin, 15);

  game = startNextRound({ ...game, phase: "round-over", completedRounds: 2 });
  assert.equal(game.scoreToWin, 20);
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
