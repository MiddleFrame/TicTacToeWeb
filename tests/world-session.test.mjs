import assert from "node:assert/strict";
import test from "node:test";
import * as collections from "../app/game/collections.ts";
import * as cards from "../app/game/cards.ts";
import * as localProgress from "../app/game/local-player-progress.ts";
import * as queue from "../app/game/progress-operation-queue.ts";
import * as operationGate from "../app/game/account-operation-gate.ts";
import * as cardPurchase from "../app/game/card-purchase.ts";
import * as elementProgress from "../app/game/element-progression.ts";
import * as localCommit from "../app/game/local-progress-commit.ts";
import { createAnimationClock, createHookRuntime, jsxRuntime, loadFrontendModule } from "./helpers/frontend-runtime.mjs";
import { memoryStorage } from "./helpers/hook-harness.mjs";

function sessionFixture() {
  const hooks = createHookRuntime();
  const clock = createAnimationClock();
  const storage = memoryStorage();
  clock.globals.window.localStorage = storage;
  const noop = () => undefined;
  const gates = [];
  const progression = { sync: noop };
  const react = { ...hooks.react, createContext: () => ({ Provider: "session-provider" }) };
  const { usePlayerCollection } = loadFrontendModule("app/components/game/hooks/usePlayerCollection.ts", {
    react,
    "../../../game/collections": collections,
    "../../../game/cards": cards,
    "../../../game/local-player-progress": localProgress,
    "../../../game/progress-operation-queue": queue,
    "../../../game/account-operation-gate": { createAccountOperationGate: () => {
      const gate = operationGate.createAccountOperationGate(); gates.push(gate); return gate;
    } },
    "./useCloudAccount": { useCloudAccount: (_apply, gate) => ({
      assertMutable: () => gate.assertMutable(), requestSync: noop, mutationsBlocked: false,
    }) },
    "../../../game/card-purchase": cardPurchase,
    "../../../game/element-progression": elementProgress,
    "../../../game/local-progress-commit": localCommit,
    "./useElementProgression": { useElementProgression: () => progression },
  }, { ...clock.globals, crypto });
  const { GameSessionProvider } = loadFrontendModule("app/components/game/GameSessionProvider.tsx", {
    react, "react/jsx-runtime": jsxRuntime,
    "./hooks/useAppActivity": { useAppActivity: () => true },
    "./hooks/useGameAudio": { useGameAudio: () => ({ playSfx: noop }) },
    "./hooks/usePlayerCollection": { usePlayerCollection },
  });
  const render = (world) => {
    const element = hooks.render(() => GameSessionProvider({ children: { world } }));
    hooks.commit();
    return element.props.value;
  };
  return { hooks, clock, storage, gates, render, GameSessionProvider };
}

test("a pending Plus reward keeps its owner across TTTR and return, preserving newer profile state", async () => {
  const f = sessionFixture();
  f.render("tttp");
  await f.clock.tickTimer();
  const initial = f.render("tttp");
  const attempt = initial.collection.beginRewardAd();
  assert.ok(attempt);
  f.render("tttr");
  const returned = f.render("tttp");
  assert.equal(f.gates.length, 1);
  assert.throws(() => f.gates[0].beginTransition(), /account-operation-pending/);
  returned.collection.changeName("NEW PROFILE");
  attempt.complete(true);
  attempt.complete(true);
  const saved = localProgress.readLocalPlayerProgress(f.storage);
  assert.equal(saved.nickname, "NEW PROFILE");
  assert.equal(saved.coins, localProgress.initialLocalPlayerProgress().coins + cardPurchase.CARD_PRICE);
  assert.equal(queue.readProgressOperations(f.storage).filter((entry) => entry.type === "reward-ad").length, 1);
  const release = f.gates[0].beginTransition();
  release();
  f.hooks.unmount();
});

test("the application session wraps the dynamic world selection instead of mounting in a scene", () => {
  const f = sessionFixture();
  const { GameClient } = loadFrontendModule("app/components/GameClient.tsx", {
    "react/jsx-runtime": jsxRuntime,
    "./game/hooks/useGameWorld": { useGameWorld: () => { throw new Error("world selector is inside the provider"); } },
    "./game/WorldLoading": { WorldLoading: () => null },
    "./game/DeferredScreen": { DeferredScreen: () => null },
    "./game/GameSessionProvider": { GameSessionProvider: f.GameSessionProvider },
    "../game/localization": { useLocalization: () => ({ language: "ru" }) },
  });
  const root = GameClient();
  assert.equal(root.type, f.GameSessionProvider);
  assert.equal(typeof root.props.children.type, "function");
});
