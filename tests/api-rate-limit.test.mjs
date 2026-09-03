import assert from "node:assert/strict";
import test from "node:test";
import { apiRatePolicy, cleanRateLimits, clientRateSubject, consumeRateLimit, rateKey, RateDenialCache } from "../app/backend/rate-limit.ts";
import { createTestDb } from "./helpers/sqlite-d1.mjs";

test("API protection covers all API routes with stricter guest and Google limits", () => {
  assert.equal(apiRatePolicy("/game/card.webp", "GET"), null);
  assert.equal(apiRatePolicy("/api/account/guest", "OPTIONS"), null);
  assert.equal(apiRatePolicy("/api/account/guest/", "POST").name, "guest");
  assert.equal(apiRatePolicy("/api/account/google", "POST").name, "google");
  assert.equal(apiRatePolicy("/api/admin/accounts/abc", "GET").name, "admin");
  assert.equal(apiRatePolicy("/api/progress", "PATCH").name, "write");
  assert.equal(apiRatePolicy("/api/future-endpoint", "GET").name, "read");
});

test("IP limits ignore attacker-controlled forwarded headers and group IPv6 /64 addresses", () => {
  const request = new Request("https://test.example/api/account", { headers: { "cf-connecting-ip": "203.0.113.7", "x-forwarded-for": "1.2.3.4" } });
  assert.equal(clientRateSubject(request), "unknown-client");
  assert.equal(clientRateSubject(request, true), "203.0.113.7");
  Object.defineProperty(request, "cf", { value: { colo: "TEST" } });
  assert.equal(clientRateSubject(request), "203.0.113.7");
  request.headers.set("x-forwarded-for", "9.9.9.9");
  assert.equal(clientRateSubject(request), "203.0.113.7");
  request.headers.set("cf-connecting-ip", "2001:db8::1");
  assert.equal(clientRateSubject(request), "2001:db8:0:0/64");
  request.headers.set("cf-connecting-ip", "2001:0db8:0:0:0:0:0:1234");
  assert.equal(clientRateSubject(request), "2001:db8:0:0/64");
});

test("counter keys do not contain cleartext IPs and policies have separate keys", async () => {
  const policy = apiRatePolicy("/api/progress", "GET");
  const key = await rateKey("203.0.113.1", policy);
  assert.match(key, /^[a-f0-9]{64}$/);
  assert.equal(key, await rateKey("203.0.113.1", policy));
  assert.notEqual(key, await rateKey("203.0.113.1", { ...policy, name: "write" }));
});

test("atomic SQLite counters allow exactly the quota across competing calls and reset", async () => {
  const { db, sqlite } = createTestDb();
  const policy = { name: "test", limit: 5, windowMs: 60_000 };
  const results = await Promise.all(Array.from({ length: 30 }, () => consumeRateLimit(db, "key", policy, 10_000)));
  assert.equal(results.filter((result) => result.allowed).length, 5);
  assert.equal(results[29].retryAfter, 50);
  assert.equal(sqlite.prepare("SELECT hits FROM api_rate_limits").get().hits, 5);
  assert.equal((await consumeRateLimit(db, "other-key", policy, 10_000)).allowed, true);
  assert.equal((await consumeRateLimit(db, "key", policy, 60_000)).allowed, true);
  assert.equal(sqlite.prepare("SELECT hits FROM api_rate_limits WHERE key = 'key'").get().hits, 1);
  sqlite.close();
});

test("rate-limit cleanup is indexed, bounded and leaves current buckets intact", async () => {
  const { db, sqlite, queries } = createTestDb();
  const insert = sqlite.prepare("INSERT INTO api_rate_limits VALUES (?, 1, ?)");
  for (let index = 0; index < 300; index += 1) insert.run(`old-${index}`, 1);
  insert.run("active", 200_000_000);
  await cleanRateLimits(db, 100_000_000);
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS count FROM api_rate_limits").get().count, 173);
  assert.ok(sqlite.prepare("SELECT key FROM api_rate_limits WHERE key = 'active'").get());
  const plan = sqlite.prepare(`EXPLAIN QUERY PLAN ${queries.at(-1)}`).all(1);
  assert.match(JSON.stringify(plan), /idx_api_rate_limits_reset_at/);
  sqlite.close();
});

test("denial cache expires and cannot grow beyond its configured bound", () => {
  const cache = new RateDenialCache();
  cache.deny("first", 60, 0);
  assert.equal(cache.retryAfter("first", 1000), 59);
  assert.equal(cache.retryAfter("first", 60_000), 0);
  for (let index = 0; index < 2100; index += 1) cache.deny(String(index), 60, 0);
  assert.equal(cache.retryAfter("0", 1000), 0);
  assert.equal(cache.retryAfter("2099", 1000), 59);
});
