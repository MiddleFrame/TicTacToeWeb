import assert from "node:assert/strict";
import test from "node:test";
import { STARTER_SELECTED_KINDS } from "../app/game/cards.ts";
import { operationRandom } from "../app/game/card-purchase.ts";
import {
  applyLocalProgressionAction,
  cacheLocalPlayerProgress,
  initialLocalPlayerProgress,
  purchaseLocalCardPack,
  readLocalPlayerProgress,
  rewardLocalCoins,
} from "../app/game/local-player-progress.ts";
import {
  enqueueProgressOperation,
  readProgressOperations,
  removeProgressOperation,
} from "../app/game/progress-operation-queue.ts";
import { flushProgressOperations } from "../app/game/progress-sync.ts";

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  };
}

test("offline purchases update and restore the complete local snapshot", () => {
  const storage = memoryStorage();
  const initial = initialLocalPlayerProgress();
  const purchased = purchaseLocalCardPack(initial, "f49d276c-6f4f-4631-a7e9-f7c0db197c82", 1, "ice");
  cacheLocalPlayerProgress(storage, purchased.progress);
  const restored = readLocalPlayerProgress(storage);

  assert.equal(restored.coins, initial.coins - 50);
  assert.deepEqual(restored.unlockedKinds, purchased.progress.unlockedKinds);
  assert.deepEqual(restored.passes, purchased.progress.passes);
});

test("the same operation produces the same cards on device and server", () => {
  const first = operationRandom("79d8d854-1f2d-4aed-b48f-1ea9c1313d43");
  const second = operationRandom("79d8d854-1f2d-4aed-b48f-1ea9c1313d43");
  assert.deepEqual(Array.from({ length: 8 }, first), Array.from({ length: 8 }, second));
});

test("offline progression grants round XP, claims and ad currency locally", () => {
  const initial = initialLocalPlayerProgress();
  const round = applyLocalProgressionAction(initial, {
    type: "record-round",
    mode: "bot",
    kinds: STARTER_SELECTED_KINDS,
    outcome: "win",
  });
  assert.ok(round.awards.some((award) => award.amount > 0));
  const withLevel = structuredClone(round.progress);
  withLevel.passes.regular.xp = 1000;
  const claimed = applyLocalProgressionAction(withLevel, {
    type: "claim",
    collectionId: "regular",
    level: 1,
    track: "free",
  }).progress;
  assert.equal(claimed.coins, initial.coins + 10);
  assert.equal(rewardLocalCoins(claimed, 50).coins, initial.coins + 60);
});

test("pending operations survive restarts and are removed only after acknowledgement", () => {
  const storage = memoryStorage();
  const operation = { id: "6400ca7d-63e2-48b5-8ca0-043fcb481877", type: "purchase", count: 1, collectionId: "ice" };
  enqueueProgressOperation(storage, operation);
  enqueueProgressOperation(storage, operation);
  assert.deepEqual(readProgressOperations(storage), [operation]);
  removeProgressOperation(storage, operation.id);
  assert.deepEqual(readProgressOperations(storage), []);
});

test("replaceable profile operations are compacted while economy operations stay ordered", () => {
  const storage = memoryStorage();
  const reward = { id: "ed6d5c10-1b67-4186-a27d-134e6258986b", type: "reward-ad" };
  enqueueProgressOperation(storage, { id: "ab6cd6b9-a44c-4c09-9820-c36c5fb3dd2a", type: "profile", input: { nickname: "Первый" } });
  enqueueProgressOperation(storage, reward);
  enqueueProgressOperation(storage, { id: "a84cdba2-7486-4a21-bf9c-af7588edb97d", type: "profile", input: { nickname: "Второй" } });
  assert.deepEqual(readProgressOperations(storage).map((operation) => operation.type), ["reward-ad", "profile"]);
});

test("sync replays operations in order and keeps an unacknowledged operation queued", async () => {
  const storage = memoryStorage();
  const progress = initialLocalPlayerProgress();
  const first = { id: "48f64f59-22d6-4a21-8ad4-93132150dc3f", type: "reward-ad" };
  const second = { id: "e5cda063-e082-44e5-a572-828463dafd89", type: "purchase", count: 1, collectionId: "ice" };
  enqueueProgressOperation(storage, first);
  enqueueProgressOperation(storage, second);
  const sent = [];
  await assert.rejects(flushProgressOperations(storage, progress, async (operation) => {
    sent.push(operation.id);
    if (operation.id === second.id) throw new Error("offline");
    return { progress: rewardLocalCoins(progress, 50) };
  }), /offline/);
  assert.deepEqual(sent, [first.id, second.id]);
  assert.deepEqual(readProgressOperations(storage), [second]);
});

test("store purchases no longer depend on cloud readiness", async () => {
  const source = await import("node:fs/promises").then(({ readFile }) => readFile(new URL("../app/components/game/StoreScreen.tsx", import.meta.url), "utf8"));
  assert.match(source, /const canBuy = \(count: number\) => !props\.transactionPending/);
  assert.doesNotMatch(source, /const canBuy[^\n]+props\.cloudReady/);
  assert.match(source, /progressOffline/);
});
