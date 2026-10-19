import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_LEGACY_COINS,
  isOperationId,
  normalizeCoins,
  normalizeNickname,
  normalizeSelectedKinds,
  normalizeUnlockedKinds,
} from "../../app/game/player-progress.ts";


test("normalizes cached local progress for offline play", () => {
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
