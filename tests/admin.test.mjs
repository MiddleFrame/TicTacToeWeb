import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { adminSearchQuery, isAdminEmail } from "../app/backend/admin-policy.ts";
import { readAdminAccount, searchAdminAccounts } from "../app/backend/admin-data.ts";
import { createTestDb, seedAccount } from "./helpers/sqlite-d1.mjs";

test("admin email allowlist is closed by default and requires exact identities", () => {
  assert.equal(isAdminEmail("owner@example.com", undefined), false);
  assert.equal(isAdminEmail(null, "owner@example.com"), false);
  assert.equal(isAdminEmail("Owner@Example.com", " owner@example.com , second@example.com "), true);
  assert.equal(isAdminEmail("owner@example.com.attacker.test", "owner@example.com"), false);
  assert.equal(isAdminEmail("owner+other@example.com", "owner@example.com"), false);
  assert.equal(isAdminEmail("owner@example.com", "*"), false);
  assert.equal(isAdminEmail("bad email@example.com", "bad email@example.com"), false);
});

test("admin search rejects empty and oversized inputs", () => {
  assert.equal(adminSearchQuery(null), null);
  assert.equal(adminSearchQuery("  "), null);
  assert.equal(adminSearchQuery("x"), null);
  assert.equal(adminSearchQuery("x".repeat(65)), null);
  assert.equal(adminSearchQuery("  ABC123  "), "ABC123");
});

test("account search uses indexed exact matches, limits results and binds SQL input", async () => {
  const { db, sqlite, queries } = createTestDb();
  seedAccount(sqlite, "owner", "ABCDEFGH23", "Владелец");
  assert.equal((await searchAdminAccounts(db, "abcdefgh23")).accounts[0].id, "owner");
  assert.equal((await searchAdminAccounts(db, "owner")).accounts[0].nickname, "Владелец");
  assert.equal((await searchAdminAccounts(db, "Владелец")).accounts.length, 1);
  assert.equal((await searchAdminAccounts(db, "Влад")).accounts.length, 0);
  assert.equal((await searchAdminAccounts(db, "' OR 1=1 --")).accounts.length, 0);
  for (let index = 0; index < 30; index += 1) seedAccount(sqlite, `u${index}`, `CODE${index}`);
  const results = await searchAdminAccounts(db, "Тестовый игрок");
  assert.equal(results.accounts.length, 20);
  assert.equal(results.hasMore, true);
  const plan = sqlite.prepare(`EXPLAIN QUERY PLAN ${queries.at(-1)}`).all("Владелец", "ВЛАДЕЛЕЦ");
  assert.match(JSON.stringify(plan), /idx_profiles_nickname/);
  assert.match(JSON.stringify(plan), /idx_profiles_public_code/);
  sqlite.close();
});

test("admin detail reads bounded histories without changing balances and records its actor", async () => {
  const { db, sqlite } = createTestDb();
  seedAccount(sqlite, "admin", "ADMIN12345");
  seedAccount(sqlite, "player", "PLAYER1234");
  sqlite.prepare("INSERT INTO inventory VALUES ('player', 'freeze', 2, 1)").run();
  const insert = sqlite.prepare("INSERT INTO reward_ledger VALUES (?, ?, 'player', 'coins', 1, 100, 'test-reward', ?)");
  for (let index = 0; index < 60; index += 1) insert.run(`r${index}`, `op${index}`, index);
  const detail = await readAdminAccount(db, "admin", "player", 100);
  assert.equal(detail.account.coins, 100);
  assert.equal(detail.inventory[0].itemId, "freeze");
  assert.equal(detail.ledger.length, 50);
  assert.equal(detail.ledger[0].id, "r59");
  assert.equal(detail.moreLedger, true);
  assert.equal(detail.audit[0].actorUserId, "admin");
  assert.equal(detail.audit[0].action, "account-view");
  assert.equal(sqlite.prepare("SELECT coins FROM wallets WHERE user_id = 'player'").get().coins, 100);
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS count FROM reward_ledger").get().count, 60);
  assert.equal(await readAdminAccount(db, "admin", "missing", 101), null);
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS count FROM admin_audit_log").get().count, 1);
  sqlite.close();
});

test("every admin data endpoint authorizes on the server and offers no mutation method", () => {
  for (const path of ["session", "accounts", "accounts/[id]"]) {
    const source = readFileSync(new URL(`../app/api/admin/${path}/route.ts`, import.meta.url), "utf8");
    assert.match(source, /await requireAdmin\(request\)/);
    assert.match(source, /if \(admin instanceof Response\) return admin/);
    assert.doesNotMatch(source, /export (?:async function|const) (?:POST|PATCH|DELETE|PUT)/);
  }
  const auth = readFileSync(new URL("../app/backend/admin-auth.ts", import.meta.url), "utf8");
  assert.match(auth, /getGoogleIdentity\(authenticated.account.id\)/);
  assert.doesNotMatch(auth, /headers.get\(.*email/);
  const session = readFileSync(new URL("../app/backend/request-session.ts", import.meta.url), "utf8");
  assert.match(session, /account\?\.status === "active"/);
});
