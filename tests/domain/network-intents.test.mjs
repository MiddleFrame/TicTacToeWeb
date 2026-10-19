import assert from "node:assert/strict";
import test from "node:test";
import { awardMatchByForfeit, createGame, endTurn } from "../../app/game/engine.ts";

import { onlineRoundAdvanceDelay } from "../../app/game/round-transition.ts";
import { applyNetworkIntent } from "../../app/game/photon.ts";

test("awards the online match when the opponent leaves", () => {
  const result = awardMatchByForfeit(createGame(), 2);

  assert.equal(result.phase, "game-over");
  assert.equal(result.roundWinner, 2);
  assert.equal(result.gameWinner, 2);
  assert.equal(result.roundWins[2], 2);
});

test("online rounds start two seconds after their result animation", () => {
  assert.equal(onlineRoundAdvanceDelay(1), 5400);
  assert.equal(onlineRoundAdvanceDelay(null), 6300);
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
