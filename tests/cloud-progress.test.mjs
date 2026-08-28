import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  MAX_LEGACY_COINS,
  isOperationId,
  normalizeCoins,
  normalizeNickname,
  normalizeSelectedKinds,
  normalizeUnlockedKinds,
} from "../app/game/player-progress.ts";

const readProjectFile = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("normalizes legacy progress before its one-time cloud import", () => {
  const unlocked = normalizeUnlockedKinds(["shortage", "broken", "shortage"]);

  assert.ok(unlocked.includes("place"));
  assert.ok(unlocked.includes("shortage"));
  assert.equal(unlocked.filter((kind) => kind === "shortage").length, 1);
  assert.equal(normalizeCoins(Number.POSITIVE_INFINITY), 0);
  assert.equal(normalizeCoins(MAX_LEGACY_COINS + 1), MAX_LEGACY_COINS);
  assert.equal(normalizeNickname("  Cloud   Player  ", "Игрок"), "Cloud Player");
});

test("accepts only playable unlocked deck selections", () => {
  const unlocked = normalizeUnlockedKinds(["shortage"]);

  assert.deepEqual(
    normalizeSelectedKinds(["place", "random-effect", "place-draw", "freeze-3", "shortage"], unlocked),
    ["place", "random-effect", "place-draw", "freeze-3", "shortage"],
  );
  assert.equal(normalizeSelectedKinds(["shortage"], unlocked).length, 5);
});

test("requires stable idempotency keys for economy operations", () => {
  assert.equal(isOperationId("d476cf85-9374-410a-b27f-b5e441ada95e"), true);
  assert.equal(isOperationId("short"), false);
});

test("cloud progress routes authenticate writes and record economy operations", async () => {
  const [progressRoute, purchaseRoute, rewardRoute, backend, migration] = await Promise.all([
    readProjectFile("app/api/progress/route.ts"),
    readProjectFile("app/api/store/purchase/route.ts"),
    readProjectFile("app/api/rewards/ad/route.ts"),
    readProjectFile("app/backend/progress.ts"),
    readProjectFile("drizzle/0001_natural_colonel_america.sql"),
  ]);

  assert.match(progressRoute, /authenticateRequest/);
  assert.match(purchaseRoute, /isOperationId/);
  assert.match(rewardRoute, /reward-rate-limited/);
  assert.match(backend, /legacy-import/);
  assert.match(backend, /storePurchases/);
  assert.match(migration, /CREATE TABLE `player_progress`/);
  assert.match(migration, /CREATE TABLE `store_purchases`/);
});

test("Android sessions use a Keystore-backed native bridge", async () => {
  const [plugin, activity, client, viteConfig] = await Promise.all([
    readProjectFile("android/app/src/main/java/com/MiddleFrame/Tictactoe/SecureSessionPlugin.java"),
    readProjectFile("android/app/src/main/java/com/MiddleFrame/Tictactoe/MainActivity.java"),
    readProjectFile("app/game/player-progress-client.ts"),
    readProjectFile("vite.android.config.ts"),
  ]);

  assert.match(plugin, /AndroidKeyStore/);
  assert.match(plugin, /AES\/GCM\/NoPadding/);
  assert.match(activity, /registerPlugin\(SecureSessionPlugin\.class\)/);
  assert.match(client, /Authorization: `Bearer/);
  assert.match(viteConfig, /NEXT_PUBLIC_API_ORIGIN/);
});
