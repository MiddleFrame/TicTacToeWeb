import assert from "node:assert/strict";
import test from "node:test";
import { createAccountOperationGate } from "../app/game/account-operation-gate.ts";
import { ProgressRequestError, classifyProgressError, parseRetryAfter, progressRetryDelay } from "../app/game/progress-request-error.ts";
import { initialLocalPlayerProgress, cacheLocalPlayerProgress, readLocalPlayerProgress, purchaseLocalCardPack } from "../app/game/local-player-progress.ts";
import { commitLocalProgressOperation } from "../app/game/local-progress-commit.ts";
import { readProgressOperations, enqueueProgressOperation } from "../app/game/progress-operation-queue.ts";
import { flushProgressOperations } from "../app/game/progress-sync.ts";
import { adoptCloudAccount } from "../app/game/account-cache.ts";
import { deferred, memoryStorage } from "./helpers/hook-harness.mjs";

test("account transitions exclude new commands and rewarded attempts until released", () => {
  const gate = createAccountOperationGate();
  const release = gate.beginTransition();
  assert.throws(() => gate.assertMutable(), /account-transition-pending/);
  assert.throws(() => gate.beginTransition(), /account-operation-pending/);
  assert.equal(gate.beginReward(() => assert.fail("reward while switching")), null);
  release();
  release();
  gate.assertMutable();
});

test("a rewarded attempt owns the account barrier through completion and completes only once", () => {
  const gate = createAccountOperationGate();
  let rewards = 0;
  const attempt = gate.beginReward(() => rewards++);
  assert.throws(() => gate.beginTransition(), /account-operation-pending/);
  assert.equal(gate.beginReward(() => rewards++), null);
  attempt.complete(true);
  attempt.complete(true);
  attempt.complete(false);
  assert.equal(rewards, 1);
  gate.beginTransition()();
});

test("cancelled ads release the account barrier without granting currency", () => {
  const gate = createAccountOperationGate();
  gate.beginReward(() => assert.fail("cancelled reward")).complete(false);
  gate.beginTransition()();
});

test("retry policy distinguishes rejection, expired auth, busy and quota; respects Retry-After", () => {
  assert.equal(classifyProgressError(new ProgressRequestError("reward-unavailable", 400)), "conflict");
  assert.equal(progressRetryDelay(new ProgressRequestError("reward-unavailable", 400), 0), null);
  assert.equal(classifyProgressError(new ProgressRequestError("unauthorized", 401)), "auth-required");
  assert.equal(progressRetryDelay(new ProgressRequestError("unauthorized", 401), 0), null);
  assert.equal(classifyProgressError(new ProgressRequestError("progress-busy", 400)), "offline");
  assert.equal(progressRetryDelay(new Error("network failed"), 0, () => 0.5), 1000);
  assert.equal(progressRetryDelay(new Error("network failed"), 100, () => 0.5), 60_000);
  assert.equal(progressRetryDelay(new ProgressRequestError("reward-rate-limited", 429, 120_000), 0), 120_000);
  assert.equal(progressRetryDelay(new ProgressRequestError("reward-rate-limited", 429), 0), 3_600_000);
  assert.equal(parseRetryAfter("60", 0), 60_000);
  assert.equal(parseRetryAfter("Thu, 01 Jan 1970 00:01:00 GMT", 0), 60_000);
  assert.equal(parseRetryAfter("bad"), null);
});

test("late or wrong-account acknowledgements cannot remove pending operations", async () => {
  const storage = memoryStorage();
  const initial = { ...initialLocalPlayerProgress(), accountId: "account-a" };
  const operation = { id: crypto.randomUUID(), type: "reward-ad" };
  enqueueProgressOperation(storage, operation);
  const response = deferred();
  let active = true;
  const flushing = flushProgressOperations(storage, initial, () => response.promise, () => active);
  active = false;
  response.resolve({ progress: initial });
  await assert.rejects(flushing, /session-changed/);
  assert.deepEqual(readProgressOperations(storage), [operation]);
  await assert.rejects(flushProgressOperations(storage, initial, async () => ({ progress: { ...initial, accountId: "account-b" } })), /account-progress-conflict/);
  assert.deepEqual(readProgressOperations(storage), [operation]);
});

test("account adoption refuses to erase another account's pending actions", () => {
  const storage = memoryStorage();
  adoptCloudAccount(storage, "account-a");
  const operation = { id: crypto.randomUUID(), type: "reward-ad" };
  enqueueProgressOperation(storage, operation);
  assert.throws(() => adoptCloudAccount(storage, "account-b"), /account-progress-conflict/);
  assert.equal(storage.getItem("tttp-cloud-account"), "account-a");
  assert.deepEqual(readProgressOperations(storage), [operation]);
});

test("snapshot write rejection restores the previous queue without showing an uncommitted purchase", () => {
  const storage = memoryStorage();
  const initial = initialLocalPlayerProgress();
  cacheLocalPlayerProgress(storage, initial);
  const existing = { id: crypto.randomUUID(), type: "reward-ad" };
  enqueueProgressOperation(storage, existing);
  const operation = { id: crypto.randomUUID(), type: "purchase", count: 1, collectionId: "ice" };
  const purchased = purchaseLocalCardPack(initial, operation.id, 1, "ice");
  const failing = { ...storage, setItem(key, value) {
    if (key === "tttp-local-progress-v2") throw new Error("quota");
    storage.setItem(key, value);
  } };
  assert.throws(() => commitLocalProgressOperation(failing, operation, purchased.progress), /quota/);
  assert.equal(readLocalPlayerProgress(storage).coins, initial.coins);
  assert.deepEqual(readProgressOperations(storage), [existing]);
});

test("current snapshot persistence uses one write and legacy-only saves still migrate on read", () => {
  const storage = memoryStorage();
  storage.setItem("tttp-coins", "321");
  assert.equal(readLocalPlayerProgress(storage).coins, 321);
  let writes = 0;
  cacheLocalPlayerProgress({ setItem(key, value) { writes++; storage.setItem(key, value); } }, initialLocalPlayerProgress());
  assert.equal(writes, 1);
  assert.equal(readLocalPlayerProgress(storage).coins, 220);
});
