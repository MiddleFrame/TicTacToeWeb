import assert from "node:assert/strict";
import test from "node:test";
import * as photon from "../app/game/photon.ts";
import * as engine from "../app/game/engine.ts";
import { createAnimationClock, createHookRuntime, loadFrontendModule } from "./helpers/frontend-runtime.mjs";

function harness() {
  const hooks = createHookRuntime();
  const clock = createAnimationClock();
  let callbacks;
  let game = engine.createGame();
  let gameWrites = 0;
  let disconnectCalls = 0;
  const session = {
    updateCallbacks(value) { callbacks = value; },
    connect: async () => {}, broadcastState() {}, sendIntent() {},
    disconnect() {
      disconnectCalls += 1;
      callbacks.onSnapshot(photon.INITIAL_PHOTON_SNAPSHOT);
    },
  };
  const sessionFactory = (value) => { callbacks = value; return session; };
  const setGame = (value) => {
    gameWrites += 1;
    game = typeof value === "function" ? value(game) : value;
  };
  const { usePhotonGame } = loadFrontendModule("app/components/game/hooks/usePhotonGame.ts", {
    react: hooks.react,
    "../../../game/photon": photon,
    "../../../game/engine": engine,
  }, clock.globals);
  hooks.render(() => usePhotonGame(game, "online", setGame, undefined, sessionFactory));
  hooks.commit();
  return {
    hooks, clock,
    get callbacks() { return callbacks; },
    get game() { return game; },
    get gameWrites() { return gameWrites; },
    get disconnectCalls() { return disconnectCalls; },
  };
}

test("Photon hook applies host state immediately after a guest snapshot without waiting for render", () => {
  const runtime = harness();
  runtime.callbacks.onSnapshot({ ...photon.INITIAL_PHOTON_SNAPSHOT, side: 2, phase: "ready" });
  const state = engine.endTurn(engine.createGame());
  runtime.callbacks.onState(state);
  assert.equal(runtime.game, state);
  assert.equal(runtime.gameWrites, 1);
});

test("Photon hook refuses remote state on the host and after disconnection", () => {
  const runtime = harness();
  runtime.callbacks.onSnapshot({ ...photon.INITIAL_PHOTON_SNAPSHOT, side: 1, phase: "ready" });
  runtime.callbacks.onState(engine.createGame());
  runtime.callbacks.onSnapshot(photon.INITIAL_PHOTON_SNAPSHOT);
  runtime.callbacks.onState(engine.createGame());
  runtime.callbacks.onIntent({ type: "end-turn" });
  assert.equal(runtime.gameWrites, 0);
});

test("Photon hook detaches state callbacks before disconnecting on unmount", () => {
  const runtime = harness();
  runtime.callbacks.onSnapshot({ ...photon.INITIAL_PHOTON_SNAPSHOT, side: 2, phase: "ready" });
  const writes = runtime.hooks.stateWrites;
  runtime.hooks.unmount();
  runtime.callbacks.onState(engine.createGame());
  runtime.callbacks.onIntent({ type: "end-turn" });
  runtime.callbacks.onOpponentLeave(2);
  assert.equal(runtime.disconnectCalls, 1);
  assert.equal(runtime.hooks.stateWrites, writes);
  assert.equal(runtime.gameWrites, 0);
});
