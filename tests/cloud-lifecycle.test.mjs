import assert from "node:assert/strict";
import test from "node:test";
import { deferred, memoryStorage, hookHarness, loadHook } from "./helpers/hook-harness.mjs";
import * as queue from "../app/game/progress-operation-queue.ts";
import * as sync from "../app/game/progress-sync.ts";
import * as errors from "../app/game/progress-request-error.ts";
import { initialLocalPlayerProgress } from "../app/game/local-player-progress.ts";
import { createAccountOperationGate } from "../app/game/account-operation-gate.ts";

const tick = async () => { for (let index = 0; index < 8; index++) await Promise.resolve(); };

function cloudFixture(overrides = {}) {
  const harness = hookHarness();
  const storage = memoryStorage();
  const timers = new Map();
  const listeners = new Map();
  let nextTimer = 0;
  const gate = createAccountOperationGate();
  const initial = { ...initialLocalPlayerProgress(), accountId: "account-a" };
  const applied = [];
  const client = {
    initializePlayerProgress: async () => initial,
    sendCloudProgressOperation: async () => ({ progress: initial }),
    getGoogleAccountState: async () => ({ available: true, linked: false, email: null }),
    connectGoogleAccount: async () => ({ progress: { ...initial, accountId: "account-b" }, email: null }),
    ...overrides,
  };
  const events = {
    addEventListener: (name, callback) => listeners.set(name, callback),
    removeEventListener: (name) => listeners.delete(name),
  };
  const exports = loadHook("app/components/game/hooks/useCloudAccount.ts", {
    react: harness.react,
    "../../../game/player-progress-client": client,
    "../../../game/progress-operation-queue": queue,
    "../../../game/progress-sync": sync,
    "../../../game/progress-request-error": errors,
  }, {
    window: {
      ...events, localStorage: storage,
      setTimeout(callback, delay) { timers.set(++nextTimer, { callback, delay }); return nextTimer; },
      clearTimeout: (id) => timers.delete(id),
    },
    document: { ...events, visibilityState: "visible" },
  });
  const apply = (value) => applied.push(value);
  const render = () => {
    const result = harness.render(() => exports.useCloudAccount(apply, gate));
    harness.effects();
    return result;
  };
  return { harness, gate, initial, applied, client, render, storage, timers, listeners };
}

test("Google switching locks mutations before awaiting queue drain and releases after adoption", async () => {
  const pending = deferred();
  const fixture = cloudFixture({ connectGoogleAccount: () => pending.promise });
  let cloud = fixture.render();
  assert.equal(await cloud.synchronize(), true);
  cloud = fixture.render();
  const switching = cloud.connectGoogle();
  assert.throws(() => cloud.assertMutable(), /account-transition-pending/);
  assert.equal(fixture.gate.beginReward(() => assert.fail("ad during switch")), null);
  await tick();
  pending.resolve({ progress: { ...fixture.initial, accountId: "account-b", coins: 700 }, email: null });
  await switching;
  assert.equal(fixture.applied.at(-1).accountId, "account-b");
  fixture.render().assertMutable();
  fixture.harness.unmount();
});

test("an active ad blocks account switching without cancelling the earned reward", async () => {
  let switches = 0;
  const fixture = cloudFixture({ connectGoogleAccount: async () => { switches++; assert.fail("switch during ad"); } });
  let cloud = fixture.render();
  await cloud.synchronize();
  cloud = fixture.render();
  let earned = 0;
  const attempt = fixture.gate.beginReward(() => earned++);
  await cloud.connectGoogle();
  assert.equal(switches, 0);
  attempt.complete(true);
  assert.equal(earned, 1);
  fixture.harness.unmount();
});

test("operations arriving while account metadata loads are drained before publishing the snapshot", async () => {
  const metadata = deferred();
  const sent = [];
  const fixture = cloudFixture({
    getGoogleAccountState: () => metadata.promise,
    sendCloudProgressOperation: async (operation) => { sent.push(operation.id); return { progress: { ...fixture.initial, coins: 170 } }; },
  });
  const cloud = fixture.render();
  const syncing = cloud.synchronize();
  await tick();
  const operation = { id: crypto.randomUUID(), type: "purchase", count: 1, collectionId: "ice" };
  queue.enqueueProgressOperation(fixture.storage, operation);
  cloud.requestSync();
  metadata.resolve({ available: true, linked: false, email: null });
  assert.equal(await syncing, true);
  assert.deepEqual(sent, [operation.id]);
  assert.equal(fixture.applied.at(-1).coins, 170);
  fixture.harness.unmount();
});

test("unmounted account hooks ignore late responses and remove event handlers", async () => {
  const pending = deferred();
  const fixture = cloudFixture({ initializePlayerProgress: () => pending.promise });
  const cloud = fixture.render();
  const syncing = cloud.synchronize();
  fixture.harness.unmount();
  pending.resolve(fixture.initial);
  assert.equal(await syncing, false);
  assert.equal(fixture.applied.length, 0);
  assert.equal(fixture.harness.writesAfterUnmount(), 0);
  assert.equal(fixture.listeners.size, 0);
});

test("temporary API failures schedule bounded retries and cancellation removes the timer", async () => {
  const fixture = cloudFixture({ initializePlayerProgress: async () => { throw new errors.ProgressRequestError("unavailable", 503, 30_000); } });
  const cloud = fixture.render();
  assert.equal(await cloud.synchronize(), false);
  assert.equal(fixture.render().syncState, "offline");
  assert.equal(fixture.timers.size, 1);
  assert.ok([...fixture.timers.values()][0].delay >= 29_000);
  fixture.harness.unmount();
  assert.equal(fixture.timers.size, 0);
});

test("permanent command rejection preserves the queue, blocks new mutations and does not retry forever", async () => {
  const fixture = cloudFixture({ sendCloudProgressOperation: async () => { throw new errors.ProgressRequestError("reward-unavailable", 400); } });
  const operation = { id: crypto.randomUUID(), type: "progression", input: { type: "claim" } };
  queue.enqueueProgressOperation(fixture.storage, operation);
  const cloud = fixture.render();
  assert.equal(await cloud.synchronize(), false);
  const rejected = fixture.render();
  assert.equal(rejected.syncState, "conflict");
  assert.throws(() => rejected.assertMutable(), /progress-reconciliation-required/);
  assert.deepEqual(queue.readProgressOperations(fixture.storage), [operation]);
  assert.equal(fixture.timers.size, 0);
  fixture.harness.unmount();
});

test("cold expired accounts expose native recovery without applying a guest snapshot", async () => {
  const fixture = cloudFixture({
    initializePlayerProgress: async () => { throw new errors.ProgressRequestError("account-session-expired", 401); },
  });
  assert.equal(await fixture.render().synchronize(), false);
  const cloud = fixture.render();
  assert.equal(cloud.syncState, "auth-required");
  assert.equal(cloud.googleAvailable, true);
  assert.throws(() => cloud.assertMutable(), /progress-reconciliation-required/);
  assert.equal(fixture.applied.length, 0);
  fixture.harness.unmount();
});

test("same-account Google recovery drains retained operations before publishing progress", async () => {
  const response = deferred();
  let restored = false;
  const sent = [];
  const fixture = cloudFixture({
    initializePlayerProgress: async () => {
      if (!restored) throw new errors.ProgressRequestError("account-session-expired", 401);
      return fixture.initial;
    },
    connectGoogleAccount: async () => { restored = true; return { progress: fixture.initial, email: null }; },
    sendCloudProgressOperation: async (operation) => { sent.push(operation.id); return response.promise; },
  });
  const operation = { id: crypto.randomUUID(), type: "reward-ad" };
  queue.enqueueProgressOperation(fixture.storage, operation);
  await fixture.render().synchronize();
  const cloud = fixture.render();
  const restoring = cloud.connectGoogle();
  await tick();
  assert.equal(fixture.applied.length, 0);
  assert.deepEqual(sent, [operation.id]);
  assert.throws(() => cloud.assertMutable(), /account-transition-pending/);
  response.resolve({ progress: { ...fixture.initial, coins: 270 } });
  await restoring;
  assert.equal(fixture.applied.length, 1);
  assert.equal(fixture.applied[0].coins, 270);
  assert.deepEqual(queue.readProgressOperations(fixture.storage), []);
  assert.equal(fixture.render().syncState, "ready");
  fixture.harness.unmount();
});

test("wrong-account recovery stays blocked and another Google selection can restore the owner", async () => {
  let session = "expired";
  let attempt = 0;
  let sends = 0;
  const fixture = cloudFixture({
    initializePlayerProgress: async () => {
      if (session === "expired") throw new errors.ProgressRequestError("account-session-expired", 401);
      if (session === "wrong") throw new errors.ProgressRequestError("account-progress-conflict", 409);
      return fixture.initial;
    },
    connectGoogleAccount: async () => {
      if (++attempt === 1) {
        session = "wrong";
        throw new errors.ProgressRequestError("account-progress-conflict", 409);
      }
      session = "owner";
      return { progress: fixture.initial, email: null };
    },
    sendCloudProgressOperation: async () => { sends++; return { progress: { ...fixture.initial, coins: 270 } }; },
  });
  const operation = { id: crypto.randomUUID(), type: "reward-ad" };
  queue.enqueueProgressOperation(fixture.storage, operation);
  await fixture.render().synchronize();
  await fixture.render().connectGoogle();
  const blocked = fixture.render();
  assert.equal(blocked.syncState, "conflict");
  assert.equal(blocked.googleError, true);
  assert.throws(() => blocked.assertMutable(), /progress-reconciliation-required/);
  assert.equal(sends, 0);
  assert.deepEqual(queue.readProgressOperations(fixture.storage), [operation]);
  await blocked.connectGoogle();
  assert.equal(attempt, 2);
  assert.equal(sends, 1);
  assert.equal(fixture.applied.at(-1).accountId, "account-a");
  assert.equal(fixture.render().syncState, "ready");
  fixture.harness.unmount();
});

test("a second Google request cannot clear the first transition's pending state", async () => {
  const pending = deferred();
  const fixture = cloudFixture({ connectGoogleAccount: () => pending.promise });
  await fixture.render().synchronize();
  const cloud = fixture.render();
  const first = cloud.connectGoogle();
  await cloud.connectGoogle();
  assert.equal(fixture.render().googlePending, true);
  assert.equal(fixture.gate.transitioning, true);
  pending.resolve({ progress: fixture.initial, email: null });
  await first;
  assert.equal(fixture.render().googlePending, false);
  fixture.harness.unmount();
});

test("a transient manual retry failure cannot unlock a permanently rejected queue", async () => {
  let response = "conflict";
  const fixture = cloudFixture({
    sendCloudProgressOperation: async () => {
      if (response === "conflict") throw new errors.ProgressRequestError("reward-unavailable", 400);
      if (response === "offline") throw new Error("synthetic network failure");
      return { progress: fixture.initial };
    },
  });
  const operation = { id: crypto.randomUUID(), type: "reward-ad" };
  queue.enqueueProgressOperation(fixture.storage, operation);
  await fixture.render().synchronize();
  response = "offline";
  await fixture.render().synchronize();
  const blocked = fixture.render();
  assert.equal(blocked.syncState, "conflict");
  assert.throws(() => blocked.assertMutable(), /progress-reconciliation-required/);
  assert.deepEqual(queue.readProgressOperations(fixture.storage), [operation]);
  response = "ready";
  assert.equal(await blocked.synchronize(), true);
  fixture.render().assertMutable();
  assert.equal(fixture.render().syncState, "ready");
  fixture.harness.unmount();
});

test("wrong-account conflict survives an offline retry and still allows explicit owner recovery", async () => {
  let session = "wrong";
  const fixture = cloudFixture({
    initializePlayerProgress: async () => {
      if (session === "wrong") throw new errors.ProgressRequestError("account-progress-conflict", 409);
      if (session === "offline") throw new Error("synthetic network failure");
      return fixture.initial;
    },
    connectGoogleAccount: async () => { session = "owner"; return { progress: fixture.initial, email: null }; },
  });
  const operation = { id: crypto.randomUUID(), type: "reward-ad" };
  queue.enqueueProgressOperation(fixture.storage, operation);
  await fixture.render().synchronize();
  session = "offline";
  await fixture.render().synchronize();
  const blocked = fixture.render();
  assert.equal(blocked.syncState, "conflict");
  assert.throws(() => blocked.assertMutable(), /progress-reconciliation-required/);
  await blocked.connectGoogle();
  assert.equal(session, "owner");
  assert.deepEqual(queue.readProgressOperations(fixture.storage), []);
  assert.equal(fixture.render().syncState, "ready");
  fixture.render().assertMutable();
  fixture.harness.unmount();
});

test("rewarded hook completes the owning attempt after unmount without duplicate shows or React writes", async () => {
  const harness = hookHarness();
  const pending = deferred();
  const gate = createAccountOperationGate();
  let shown = 0;
  let earned = 0;
  let removed = 0;
  const status = { loaded: true, loading: false, initialized: true, privacyConfigured: true };
  const exports = loadHook("app/components/game/hooks/useRewardedAd.ts", {
    react: harness.react,
    "@capacitor/core": {
      Capacitor: { getPlatform: () => "android" },
      registerPlugin: () => ({
        getStatus: async () => status,
        addListener: async () => ({ remove: async () => { removed++; } }),
        showRewarded: () => { shown++; return pending.promise; },
      }),
    },
  });
  const begin = () => gate.beginReward(() => earned++);
  const render = () => { const value = harness.render(() => exports.useRewardedAd(begin)); harness.effects(); return value; };
  render();
  await tick();
  const rewarded = render();
  rewarded.show();
  rewarded.show();
  assert.equal(shown, 1);
  assert.throws(() => gate.beginTransition(), /account-operation-pending/);
  harness.unmount();
  pending.resolve({ rewarded: true });
  await tick();
  assert.equal(earned, 1);
  assert.equal(removed, 1);
  assert.equal(harness.writesAfterUnmount(), 0);
  gate.beginTransition()();
});
