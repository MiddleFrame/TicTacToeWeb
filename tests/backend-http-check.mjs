import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { createHash, randomBytes, randomUUID } from "node:crypto";

const directory = resolve(".wrangler/state/v3/d1/miniflare-D1DatabaseObject");
const file = readdirSync(directory).find((name) => /^[a-f0-9]+\.sqlite$/.test(name));
assert.ok(file);
const sqlite = new DatabaseSync(resolve(directory, file));
sqlite.exec("PRAGMA busy_timeout = 5000; PRAGMA foreign_keys = ON");
const base = "http://localhost:3193";
const created = [];

function account(email, status = "active") {
  const id = randomUUID();
  const token = randomBytes(32).toString("hex");
  const code = randomBytes(5).toString("hex").toUpperCase();
  const now = Date.now();
  sqlite.prepare("INSERT INTO users VALUES (?, ?, ?, ?)").run(id, status, now, now);
  created.push(id);
  sqlite.prepare("INSERT INTO profiles (user_id, public_code, nickname, created_at, updated_at) VALUES (?, ?, 'HTTP test fixture', ?, ?)").run(id, code, now, now);
  sqlite.prepare("INSERT INTO wallets (user_id, coins, updated_at) VALUES (?, 100, ?)").run(id, now);
  sqlite.prepare("INSERT INTO sessions VALUES (?, ?, ?, ?)").run(createHash("sha256").update(token).digest("hex"), id, now + 60_000, now);
  if (email) sqlite.prepare("INSERT INTO identities (id, user_id, provider, provider_user_id, provider_email, created_at) VALUES (?, ?, 'google', ?, ?, ?)").run(randomUUID(), id, id, email, now);
  return { id, code, headers: { Cookie: `tttp_session=${token}` } };
}

try {
  const page = await fetch(`${base}/admin`);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /Администрирование/);
  const admin = account("admin-check@example.test");
  const guest = account(null);
  const impostor = account("someone@example.test");
  const banned = account("admin-check@example.test", "banned");
  const expired = account("admin-check@example.test");
  sqlite.prepare("UPDATE sessions SET expires_at = 0 WHERE user_id = ?").run(expired.id);
  for (const path of ["/api/admin/session", "/api/admin/accounts?query=ABCD", `/api/admin/accounts/${guest.id}`]) {
    assert.equal((await fetch(base + path)).status, 401);
    assert.equal((await fetch(base + path, { headers: guest.headers })).status, 403);
    assert.equal((await fetch(base + path, { headers: { ...impostor.headers, "X-Admin-Email": "admin-check@example.test", "oai-authenticated-user-email": "admin-check@example.test" } })).status, 403);
    assert.equal((await fetch(base + path, { headers: banned.headers })).status, 401);
    assert.equal((await fetch(base + path, { headers: expired.headers })).status, 401);
  }
  const auth = await fetch(`${base}/api/admin/session`, { headers: admin.headers });
  assert.equal(auth.status, 200);
  const search = await fetch(`${base}/api/admin/accounts?query=${guest.code}`, { headers: admin.headers });
  assert.equal(search.status, 200);
  assert.equal((await search.json()).accounts[0].id, guest.id);
  const detail = await fetch(`${base}/api/admin/accounts/${guest.id}`, { headers: admin.headers });
  assert.equal(detail.status, 200);
  assert.equal(detail.headers.get("cache-control"), "no-store");
  assert.equal(detail.headers.get("access-control-allow-origin"), null);
  const data = await detail.json();
  assert.equal(data.account.coins, 100);
  assert.equal(data.audit[0].actorUserId, admin.id);
  assert.equal(data.account.sessionToken, undefined);
  assert.equal((await fetch(`${base}/api/admin/accounts`, { method: "POST", headers: admin.headers })).status, 405);
  const options = await fetch(`${base}/api/progress`, { method: "OPTIONS", headers: { Origin: "https://localhost" } });
  assert.equal(options.status, 204);
  assert.equal(options.headers.get("access-control-allow-origin"), "https://localhost");
  const flood = await Promise.all(Array.from({ length: 65 }, (_, index) => fetch(`${base}/api/admin/session`, { headers: { "X-Forwarded-For": `203.0.113.${index}` } })));
  const throttled = flood.filter((response) => response.status === 429);
  assert.ok(throttled.length > 0);
  assert.ok(Number(throttled[0].headers.get("retry-after")) > 0);
  assert.equal((await throttled[0].json()).error, "rate-limited");
  console.log(JSON.stringify({ page: 200, anonymous: 401, guest: 403, forgedEmail: 403, banned: 401, expired: 401, admin: 200, auditedRead: true, mutation: 405, androidCors: true, throttledRequests: throttled.length }));
} finally {
  for (const id of created) {
    sqlite.prepare("DELETE FROM admin_audit_log WHERE actor_user_id = ? OR target_user_id = ?").run(id, id);
    sqlite.prepare("DELETE FROM users WHERE id = ?").run(id);
  }
  sqlite.close();
}
