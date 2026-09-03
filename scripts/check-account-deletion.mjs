import assert from "node:assert/strict";

const base = new URL(process.argv[2] ?? "http://127.0.0.1:3000");
if (!new Set(["127.0.0.1", "localhost"]).has(base.hostname)) throw new Error("Local test server required; never run against player data");
const clients = [];

async function request(path, client, method = "GET", body) {
  const response = await fetch(new URL(path, base), {
    method,
    headers: {
      ...(client?.token ? { Authorization: `Bearer ${client.token}`, "X-TTTP-Client": "android" } : {}),
      ...(client?.cookie ? { Cookie: client.cookie } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response.json().catch(() => null);
  return { response, data };
}

async function guest() {
  const result = await fetch(new URL("/api/account/guest", base), { method: "POST", headers: { "X-TTTP-Client": "android" } });
  assert.equal(result.status, 201);
  const data = await result.json();
  const client = { token: data.sessionToken, account: data.account, removed: false };
  assert.ok(client.token);
  clients.push(client);
  return client;
}

async function remove(client) {
  const prepared = await request("/api/account/deletion", client, "POST", { publicCode: client.account.profile.publicCode, confirm: "DELETE" });
  assert.equal(prepared.response.status, 200, JSON.stringify(prepared.data));
  const body = { ticket: prepared.data.ticket, publicCode: client.account.profile.publicCode, confirm: "DELETE" };
  const result = await request("/api/account/deletion", client, "DELETE", body);
  assert.equal(result.response.status, 200, JSON.stringify(result.data));
  assert.equal(result.data.deleted, true);
  client.removed = true;
  return body;
}

try {
  for (const path of ["/", "/delete-account", "/privacy"]) {
    const page = await fetch(new URL(path, base));
    assert.equal(page.status, 200, path);
  }
  assert.equal((await request("/api/account/deletion", null)).response.status, 401);
  assert.equal((await request("/api/account/deletion", null, "DELETE", { confirm: "DELETE" })).response.status, 400);
  assert.equal((await request("/api/account/deletion/google", null, "POST", { idToken: "fake" })).response.status, 403);
  const owner = await guest();
  const other = await guest();
  const info = await request("/api/account/deletion", owner);
  assert.equal(info.data.account.publicCode, owner.account.profile.publicCode);
  assert.equal(info.data.googleRequired, false);
  assert.equal((await request("/api/account/deletion", owner, "POST", { confirm: "DELETE", publicCode: other.account.profile.publicCode })).response.status, 400);
  const proof = await remove(owner);
  assert.equal((await request("/api/account", owner)).response.status, 401);
  assert.equal((await request("/api/progress", owner)).response.status, 401);
  assert.equal((await request("/api/account/deletion", owner, "DELETE", proof)).response.status, 410);
  assert.equal((await request("/api/account", other)).response.status, 200);
  const fresh = await guest();
  assert.notEqual(fresh.account.id, owner.account.id);
  assert.equal(fresh.account.wallet.coins, 220);
  const imported = await request("/api/progress/import", fresh, "POST", { coins: 999999, nickname: "Deleted progress", unlockedKinds: ["freeze-cell"] });
  assert.equal(imported.response.status, 200);
  assert.equal(imported.data.legacyImportDisabled, true);
  assert.equal(imported.data.progress.coins, 220);
  assert.notEqual(imported.data.progress.nickname, "Deleted progress");
  console.log("PASS: pages, auth, native bearer, foreign target rejection, deletion, revoked sessions, replay and retired legacy import");
} finally {
  for (const client of clients.filter((value) => !value.removed)) await remove(client);
  console.log("Removed only the temporary guest accounts created by this check.");
}
