import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { deletionInput, deletionGoogleAccount, deletionSessionAccount, issueDeletionTicket, deleteAccountWithTicket } from "../app/backend/account-deletion.ts";
import { readDeletionBody } from "../app/backend/deletion-request.ts";
import { hashSessionToken } from "../app/backend/session.ts";
import { adoptCloudAccount, clearAccountCache } from "../app/game/account-cache.ts";
import { apiRatePolicy } from "../app/backend/rate-limit.ts";
import { createTestDb, seedAccount } from "./helpers/sqlite-d1.mjs";

const code = "ABCDEFGH23";
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

async function fixture() {
  const state = createTestDb();
  const { sqlite } = state;
  seedAccount(sqlite, "owner", code);
  seedAccount(sqlite, "other", "ABCDEFGH24");
  sqlite.prepare("INSERT INTO identities (id, user_id, provider, provider_user_id, provider_email, created_at) VALUES ('guest', 'owner', 'guest', 'owner', NULL, 1)").run();
  sqlite.prepare("INSERT INTO identities (id, user_id, provider, provider_user_id, provider_email, created_at) VALUES ('google', 'owner', 'google', 'google-owner', 'owner@example.com', 1)").run();
  sqlite.prepare("INSERT INTO sessions VALUES (?, 'owner', 999999, 1)").run(await hashSessionToken("a".repeat(64)));
  sqlite.prepare("INSERT INTO sessions VALUES (?, 'owner', 999999, 1)").run(await hashSessionToken("b".repeat(64)));
  sqlite.prepare("INSERT INTO player_progress VALUES ('owner', '[\"place\"]', 1, 1, 1)").run();
  sqlite.prepare("INSERT INTO inventory VALUES ('owner', 'freeze', 1, 1)").run();
  sqlite.prepare("INSERT INTO store_purchases VALUES ('buy', 'owner', '[]', 50, 1)").run();
  sqlite.prepare("INSERT INTO reward_ledger VALUES ('reward', 'op', 'owner', 'coins', 50, 100, 'reward', 1)").run();
  sqlite.prepare("INSERT INTO admin_audit_log VALUES ('view1', 'other', 'owner', 'account-view', 1)").run();
  sqlite.prepare("INSERT INTO admin_audit_log VALUES ('view2', 'owner', 'other', 'account-view', 1)").run();
  return state;
}

test("deletion removes all account data, both directions of audit and every device session", async () => {
  const { db, sqlite } = await fixture();
  const ticket = await issueDeletionTicket(db, "owner", 100);
  assert.equal(sqlite.prepare("SELECT token_hash FROM account_deletion_tickets").get().token_hash, await hashSessionToken(ticket));
  assert.equal(await deleteAccountWithTicket(db, ticket, code, 101), "owner");
  for (const table of ["identities", "sessions", "inventory", "player_progress", "store_purchases", "reward_ledger", "admin_audit_log", "account_deletion_tickets"]) {
    assert.equal(sqlite.prepare(`SELECT count(*) AS n FROM ${table}`).get().n, 0, table);
  }
  for (const table of ["users", "profiles", "wallets"]) assert.equal(sqlite.prepare(`SELECT count(*) AS n FROM ${table}`).get().n, 1, table);
  assert.equal(await deletionSessionAccount(db, "a".repeat(64), 102), null);
  assert.equal(await deletionSessionAccount(db, "b".repeat(64), 102), null);
  assert.equal(await deletionGoogleAccount(db, "google-owner"), null);
  assert.equal(await deleteAccountWithTicket(db, ticket, code, 103), null);
  sqlite.close();
});

test("wrong confirmation, forged and expired tickets never delete any account", async () => {
  const { db, sqlite } = await fixture();
  const ticket = await issueDeletionTicket(db, "owner", 100);
  assert.equal(await deleteAccountWithTicket(db, ticket, "ABCDEFGH24", 101), null);
  assert.equal(await deleteAccountWithTicket(db, "f".repeat(64), code, 101), null);
  assert.equal(await deleteAccountWithTicket(db, ticket, code, 600100), null);
  assert.equal(sqlite.prepare("SELECT count(*) AS n FROM users").get().n, 2);
  assert.equal(sqlite.prepare("SELECT count(*) AS n FROM admin_audit_log").get().n, 2);
  assert.equal(deletionInput({ ticket, publicCode: code, confirm: "DELETE" }).ticket, ticket);
  for (const input of [null, {}, { ticket, publicCode: code }, { ticket, publicCode: "' OR 1=1", confirm: "DELETE" }]) assert.equal(deletionInput(input), null);
  sqlite.close();
});

test("new confirmation invalidates the old ticket and cannot delete a recreated profile", async () => {
  const { db, sqlite } = await fixture();
  const first = await issueDeletionTicket(db, "owner", 100);
  const second = await issueDeletionTicket(db, "owner", 101);
  assert.equal(await deleteAccountWithTicket(db, first, code, 102), null);
  assert.equal(await deleteAccountWithTicket(db, second, code, 102), "owner");
  seedAccount(sqlite, "new-owner", code);
  sqlite.prepare("INSERT INTO identities (id, user_id, provider, provider_user_id, provider_email, created_at) VALUES ('new-google', 'new-owner', 'google', 'google-owner', 'owner@example.com', 1)").run();
  assert.equal(await deleteAccountWithTicket(db, second, code, 103), null);
  assert.equal((await deletionGoogleAccount(db, "google-owner")).id, "new-owner");
  sqlite.close();
});

test("deletion transaction rolls audit removal back if a database operation fails", async () => {
  const { db, sqlite } = await fixture();
  const ticket = await issueDeletionTicket(db, "owner", 100);
  sqlite.exec("CREATE TRIGGER prevent_test_delete BEFORE DELETE ON users BEGIN SELECT RAISE(ABORT, 'test-failure'); END;");
  await assert.rejects(deleteAccountWithTicket(db, ticket, code, 101), /test-failure/);
  assert.equal(sqlite.prepare("SELECT count(*) AS n FROM admin_audit_log").get().n, 2);
  assert.equal(sqlite.prepare("SELECT count(*) AS n FROM sessions").get().n, 2);
  assert.equal(sqlite.prepare("SELECT count(*) AS n FROM account_deletion_tickets").get().n, 1);
  sqlite.close();
});

test("banned owners may delete data, but stale sessions and another Google identity cannot prove ownership", async () => {
  const { db, sqlite } = await fixture();
  sqlite.prepare("UPDATE users SET status = 'banned' WHERE id = 'owner'").run();
  assert.equal((await deletionSessionAccount(db, "a".repeat(64), 100)).id, "owner");
  assert.equal(await deletionSessionAccount(db, "a".repeat(64), 1000000), null);
  assert.equal(await deletionGoogleAccount(db, "owner@example.com"), null);
  assert.equal(await deletionGoogleAccount(db, "another-subject"), null);
  const route = read("app/api/account/deletion/route.ts");
  assert.match(route, /identity.subject !== current.account.googleSubject/);
  assert.match(route, /input.publicCode !== current.account.publicCode/);
  assert.doesNotMatch(read("app/api/account/deletion/google/route.ts"), /createGuestAccount|connectGoogleIdentity|createAccountSession/);
  assert.match(read("app/backend/google-identity.ts"), /maxTokenAge: "5 minutes"/);
  sqlite.close();
});

test("deletion accepts bounded JSON only and has a dedicated API rate limit", async () => {
  const request = (body, contentType = "application/json") => new Request("https://example.com/api/account/deletion", { method: "POST", headers: { "Content-Type": contentType }, body });
  assert.deepEqual(await readDeletionBody(request('{"confirm":"DELETE"}')), { confirm: "DELETE" });
  assert.equal(await readDeletionBody(request('{"confirm":"DELETE"}', "text/plain")), null);
  assert.equal(await readDeletionBody(request("[1]")), null);
  assert.equal(await readDeletionBody(request("{")), null);
  assert.equal(await readDeletionBody(request(JSON.stringify({ idToken: "x".repeat(12001) }))), null);
  for (const path of ["/api/account/deletion", "/api/account/deletion/google"]) assert.equal(apiRatePolicy(path, "POST").limit, 20);
});

test("deleted account caches and queued rewards never migrate to a new cloud account", () => {
  const values = new Map([["tttp-coins", "999"], ["tttp-pending-rewards", "[\"old\"]"], ["tttp-cloud-account", "old"], ["tttp-theme", "dark"]]);
  const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) };
  adoptCloudAccount(storage, "new");
  assert.equal(storage.getItem("tttp-pending-rewards"), null);
  assert.equal(storage.getItem("tttp-cloud-account"), "new");
  clearAccountCache(storage);
  assert.equal(storage.getItem("tttp-coins"), "0");
  assert.equal(storage.getItem("tttp-cloud-account"), null);
  assert.equal(storage.getItem("tttp-theme"), "dark");
  assert.doesNotMatch(read("app/api/progress/import/route.ts"), /importLegacyProgress|request.json/);
  assert.doesNotMatch(read("app/game/player-progress-client.ts"), /JSON.stringify\(local\)|\/api\/progress\/import/);
});
