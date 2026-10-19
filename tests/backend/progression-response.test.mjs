import assert from "node:assert/strict";
import test from "node:test";
import * as progression from "../../app/game/element-progression.ts";
import { progressionResponse } from "../../app/backend/progression-response.ts";
import { apiJson, apiOptions } from "../../app/backend/responses.ts";
import { initialLocalPlayerProgress } from "../../app/game/local-player-progress.ts";

test("old clients see legacy scale and no fictional unclaimed new rewards without changing stored state", async () => {
  const progress = initialLocalPlayerProgress();
  progress.passes.regular.xp = 277750;
  progress.passes.ice = progression.normalizePass({ xp: 2000, premium: true, claimed: ["1:free"] }, "ice");
  const body = { progress, progressionVersion: 2, awards: [{ collectionId: "ice", amount: 270, before: 250, after: 520 }], drops: [{ kind: "freeze-3", duplicate: true, collectionId: "ice", xp: 270, xpBefore: 250, xpAfter: 520 }] };
  const original = structuredClone(body);
  const legacy = progressionResponse(body, null);
  assert.equal(legacy.progress.passes.regular.xp, 100000);
  assert.deepEqual(progression.availableClaims(legacy.progress.passes.regular), []);
  assert.equal(legacy.progress.passes.ice.xp, 2000);
  assert.equal(progression.availableClaims(legacy.progress.passes.ice).length, 3);
  assert.deepEqual(legacy.awards[0], { collectionId: "ice", amount: 1000, before: 1000, after: 2000 });
  assert.equal(legacy.drops[0].xp, 1000);
  assert.deepEqual(body, original);
  assert.equal(progressionResponse(body, "2"), body);
  const request = new Request("https://test.invalid/api/progress", { headers: { Origin: "https://localhost", "X-TTTP-Progression": "2" } });
  const response = apiJson(request, body);
  assert.equal((await response.json()).progress.passes.regular.xp, 277750);
  assert.match(apiOptions(request).headers.get("Access-Control-Allow-Headers"), /X-TTTP-Progression/);
});

test("old offline clients cannot promise a new-only reward when crossing their next projected level", () => {
  const progress = initialLocalPlayerProgress();
  progress.passes.ice.xp = 249;
  const legacy = progressionResponse({ progress }, null).progress.passes.ice;
  assert.equal(legacy.xp, 996);
  legacy.xp += 6;
  assert.deepEqual(progression.availableClaims(legacy), []);
  progression.awardExperience(progress.passes, { ice: 6 }, 1);
  assert.equal(progress.passes.ice.xp, 250);
  assert.equal(progression.canClaim(progress.passes.ice, 1, "free"), false);
  assert.deepEqual(progress.passes.ice.claimed, []);
  progression.awardExperience(progress.passes, { ice: 994 }, 1);
  const earned = progressionResponse({ progress }, null).progress.passes.ice;
  assert.equal(earned.claimed.includes("1:free"), false);
  assert.equal(earned.claimed.includes("2:free"), true);
});
