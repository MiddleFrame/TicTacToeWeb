import assert from "node:assert/strict";
import test from "node:test";
import { CARD_DEFINITIONS } from "../app/game/cards.ts";
import {
  awardMatchByForfeit, canPlayCard, createGame, endTurn, playCard,
  settleClear, settleThaw, startNextRound,
} from "../app/game/engine.ts";
import { isNetworkGameState, isNetworkIntent } from "../app/game/network-message.ts";
import { applyNetworkIntent } from "../app/game/photon.ts";

test("the network schema accepts real engine transitions and all round sizes", (context) => {
  let seed = 48271;
  context.mock.method(Math, "random", () => {
    seed = (seed * 48271) % 2147483647;
    return seed / 2147483647;
  });
  let state = createGame(Object.keys(CARD_DEFINITIONS));
  const sizes = new Set();
  for (let index = 0; index < 1800; index += 1) {
    assert.equal(isNetworkGameState(state), true, `${index}: ${state.phase}`);
    sizes.add(state.size);
    if (state.phase === "round-over") state = startNextRound(state);
    else if (state.phase === "game-over") state = createGame(Object.keys(CARD_DEFINITIONS));
    else if (state.phase === "clearing") state = settleClear(state);
    else if (state.phase === "thawing") state = settleThaw(state);
    else {
      const candidate = state.hands[state.turn].flatMap((card) =>
        state.board.map((_, target) => ({ card, target })))
        .find(({ card, target }) => canPlayCard(state, card.id, target));
      state = candidate ? playCard(state, candidate.card.id, candidate.target) : endTurn(state);
    }
  }
  assert.deepEqual([...sizes].sort(), [3, 4, 5]);
  assert.equal(isNetworkGameState(awardMatchByForfeit(state, 2)), true);
});

test("state messages reject malformed nested structures, indices and unbounded pools", () => {
  const mutations = [
    (state) => { delete state.manaByPlayer; },
    (state) => { state.board[0] = 3; },
    (state) => { delete state.board[0]; },
    (state) => { state.board.push(null); },
    (state) => { state.size = 10000; },
    (state) => { state.phase = "invalid"; },
    (state) => { state.turn = "2"; },
    (state) => { state.scores[1] = NaN; },
    (state) => { state.maxMana = Infinity; },
    (state) => { state.mana = -1; },
    (state) => { state.hands[1][0].kind = "constructor"; },
    (state) => { state.hands[1][0].id = "x".repeat(129); },
    (state) => { state.hands[1].push(state.decks[1][0]); },
    (state) => { state.decks[2] = Array(65).fill({ id: "card", kind: "place" }); },
    (state) => { state.clearingCells = [9]; },
    (state) => { state.thawingCells = [0, 0]; },
    (state) => { state.frozen = { 9: { owner: 1, turns: 2 } }; },
    (state) => { state.frozen = { 0: { owner: 4, turns: 2 } }; },
    (state) => { state.bonusCosts = { "1:invalid": 1 }; },
    (state) => { state.rechangerAvailable[2] = "true"; },
    (state) => { state.lastAction = "x".repeat(1025); },
    (state) => { state.extra = {}; },
  ];
  for (const mutate of mutations) {
    const state = createGame();
    mutate(state);
    assert.equal(isNetworkGameState(state), false, String(mutate));
  }
  for (const value of [null, undefined, [], {}, 1, "state"]) assert.equal(isNetworkGameState(value), false);
});

test("intent validation rejects coercible indices and leaves state unchanged", () => {
  const state = endTurn(createGame());
  const cardId = state.hands[2][0].id;
  for (const targetIndex of [-1, 0.5, "0", null, NaN, Infinity, 25]) {
    const intent = { type: "play", cardId, targetIndex };
    assert.equal(isNetworkIntent(intent), false);
    assert.equal(applyNetworkIntent(state, intent, 2), state);
  }
  assert.equal(applyNetworkIntent(state, { type: "play", cardId, targetIndex: 9 }, 2), state);
  assert.notEqual(applyNetworkIntent(state, { type: "play", cardId, targetIndex: 0 }, 2), state);
  for (const intent of [null, [], {}, { type: "reset" }, { type: "end-turn", extra: {} }]) {
    assert.equal(isNetworkIntent(intent), false);
  }
  for (const type of ["end-turn", "rechange", "next-round"]) assert.equal(isNetworkIntent({ type }), true);
  assert.equal(isNetworkIntent({ type: "play", cardId }), true);
});
