import assert from "node:assert/strict";
import test from "node:test";
import * as responses from "../../app/backend/responses.ts";
import { loadFrontendModule } from "../helpers/frontend-runtime.mjs";
import { createTestDb } from "../helpers/sqlite-d1.mjs";

function fixture(db) {
  class ClockDate extends Date { static now() { return Date.parse("2026-10-19T12:00:30Z"); } }
  const rateLimit = loadFrontendModule("app/backend/rate-limit.ts", {}, { Date: ClockDate });
  const guard = loadFrontendModule("app/backend/api-guard.ts", { "./responses": responses, "./rate-limit": rateLimit });
  let routed = 0;
  const worker = loadFrontendModule("worker/index.ts", {
    "../app/backend/api-guard": guard,
    "vinext/server/image-optimization": { DEFAULT_DEVICE_SIZES: [], DEFAULT_IMAGE_SIZES: [], handleImageOptimization: () => assert.fail("unexpected image request") },
    "vinext/server/app-router-entry": { default: { fetch: async () => { routed++; return Response.json({ routed: true }); } } },
  }).default;
  const pending = [];
  const fetch = request => worker.fetch(request, { DB: db }, { waitUntil: promise => pending.push(promise) });
  return { fetch, pending, get routed() { return routed; } };
}

test("Worker enforces the real SQL quota before routing despite rotating forwarded headers", async t => {
  const { db, sqlite } = createTestDb();
  t.after(() => sqlite.close());
  const f = fixture(db);
  const replies = await Promise.all(Array.from({ length: 65 }, (_, index) => f.fetch(new Request("https://test.invalid/api/admin/session", {
    headers: { "CF-Connecting-IP": "203.0.113.10", "X-Forwarded-For": `198.51.100.${index}`, Origin: "https://localhost" },
  }))));
  assert.equal(replies.filter(response => response.status === 200).length, 60);
  const denied = replies.filter(response => response.status === 429);
  assert.equal(denied.length, 5);
  assert.equal(f.routed, 60);
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM api_rate_limits").get().n, 1);
  assert.equal(sqlite.prepare("SELECT hits FROM api_rate_limits").get().hits, 60);
  for (const response of denied) {
    assert.equal(response.headers.get("Retry-After"), "30");
    assert.equal(response.headers.get("Access-Control-Allow-Origin"), "https://localhost");
    assert.equal(response.headers.get("Access-Control-Expose-Headers"), "Retry-After");
    assert.deepEqual(await response.json(), { error: "rate-limited", retryAfter: 30 });
  }
  const other = await f.fetch(new Request("https://test.invalid/api/admin/session", { headers: { "CF-Connecting-IP": "203.0.113.11" } }));
  assert.equal(other.status, 200);
  assert.equal(f.routed, 61);
  await Promise.all(f.pending);
});

test("Worker fails closed on a rate-limit database error and bypasses the guard only for non-API or preflight", async () => {
  let queries = 0;
  const f = fixture({ prepare() { queries++; throw new Error("database unavailable"); } });
  const response = await f.fetch(new Request("https://test.invalid/api/progress"));
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("Retry-After"), "30");
  assert.deepEqual(await response.json(), { error: "api-temporarily-unavailable" });
  assert.equal(f.routed, 0);
  assert.equal(queries, 1);
  for (const request of [new Request("https://test.invalid/game/icon.png"), new Request("https://test.invalid/api/progress", { method: "OPTIONS" })]) {
    assert.equal((await f.fetch(request)).status, 200);
  }
  assert.equal(f.routed, 2);
  assert.equal(queries, 1);
});
