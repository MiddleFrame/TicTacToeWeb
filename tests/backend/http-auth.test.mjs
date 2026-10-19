import assert from "node:assert/strict";
import test from "node:test";
import * as session from "../../app/backend/session.ts";
import * as responses from "../../app/backend/responses.ts";
import * as policy from "../../app/backend/admin-policy.ts";
import * as progress from "../../app/game/player-progress.ts";
import * as curve from "../../app/game/progression-curve.ts";
import { loadFrontendModule } from "../helpers/frontend-runtime.mjs";

const request = (path, body, headers = {}) => new Request(`https://test.invalid${path}`, {
  method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body),
});

test("request authentication rejects absent, malformed, expired and banned sessions and prefers a valid bearer", async () => {
  let account = { id: "owner", status: "active" };
  const lookedUp = [];
  const auth = loadFrontendModule("app/backend/request-session.ts", {
    "./session": session,
    "./accounts": { findAccountBySessionToken: async token => { lookedUp.push(token); return account; } },
  });
  for (const authorization of ["", "Bearer short", "Basic token"]) {
    assert.equal(await auth.authenticateRequest(request("/", {}, { authorization })), null);
  }
  assert.equal(lookedUp.length, 0);
  const token = "a".repeat(64);
  const req = request("/", {}, { authorization: `Bearer ${token.toUpperCase()}`, cookie: `tttp_session=${"b".repeat(64)}` });
  assert.equal((await auth.authenticateRequest(req)).token, token);
  assert.deepEqual(lookedUp, [token]);
  account = null;
  assert.equal(await auth.authenticateRequest(req), null);
  account = { id: "owner", status: "banned" };
  assert.equal(await auth.authenticateRequest(req), null);
});

test("admin authorization uses the authenticated account identity and ignores a forged email header", async () => {
  const env = { ADMIN_GOOGLE_EMAILS: "admin@example.com" };
  let authenticated = null;
  let email = "player@example.com";
  const identities = [];
  const { requireAdmin } = loadFrontendModule("app/backend/admin-auth.ts", {
    "cloudflare:workers": { env }, "./admin-policy": policy,
    "./request-session": { authenticateRequest: async () => authenticated },
    "./accounts": { getGoogleIdentity: async id => { identities.push(id); return { email }; } },
  });
  const req = request("/api/admin/session", {}, { email: "admin@example.com" });
  assert.equal((await requireAdmin(req)).status, 401);
  assert.deepEqual(identities, []);
  authenticated = { account: { id: "owner" } };
  assert.equal((await requireAdmin(req)).status, 403);
  assert.deepEqual(identities, ["owner"]);
  email = "admin@example.com";
  assert.equal((await requireAdmin(req)).id, "owner");
  env.ADMIN_GOOGLE_EMAILS = "";
  assert.equal((await requireAdmin(req)).status, 403);
});

test("each admin endpoint returns the authorization denial before querying data", async () => {
  for (const [path, prefix, dbPath] of [
    ["session", "../../../backend/", null], ["accounts", "../../../backend/", "../../../../db"],
    ["accounts/[id]", "../../../../backend/", "../../../../../db"],
  ]) {
    const denied = Response.json({ error: "admin-forbidden" }, { status: 403 });
    const forbidden = () => assert.fail("data accessed without admin authorization");
    const modules = {
      [`${prefix}admin-auth`]: { requireAdmin: async () => denied, adminJson: forbidden },
      [`${prefix}admin-data`]: { searchAdminAccounts: forbidden, readAdminAccount: forbidden },
      [`${prefix}admin-policy`]: policy,
      ...(dbPath ? { [dbPath]: { getRawDb: forbidden } } : {}),
    };
    const route = loadFrontendModule(`app/api/admin/${path}/route.ts`, modules);
    assert.equal(await route.GET(new Request("https://test.invalid/api/admin/accounts?query=owner"), { params: Promise.resolve({ id: crypto.randomUUID() }) }), denied);
    for (const method of ["POST", "PATCH", "PUT", "DELETE"]) assert.equal(route[method], undefined);
  }
});

function progressRoute(file, prefix, authenticated, ports) {
  return loadFrontendModule(file, {
    [`${prefix}backend/request-session`]: { authenticateRequest: async () => authenticated },
    [`${prefix}backend/responses`]: responses,
    [`${prefix}backend/progress`]: ports,
    [`${prefix}game/player-progress`]: progress,
    [`${prefix}game/progression-curve`]: curve,
  });
}

test("progress, profile, import and purchase routes reject unauthenticated requests before reading or writing", async () => {
  const forbidden = () => assert.fail("unauthenticated progress access");
  const ports = { getPlayerProgress: forbidden, updatePlayerProfile: forbidden, purchaseCardPack: forbidden };
  for (const [file, prefix, methods] of [
    ["app/api/progress/route.ts", "../../", ["GET", "PATCH"]],
    ["app/api/progress/import/route.ts", "../../../", ["POST"]],
    ["app/api/store/purchase/route.ts", "../../../", ["POST"]],
  ]) {
    const route = progressRoute(file, prefix, null, ports);
    for (const method of methods) {
      const response = await route[method](request("/api/progress", {}));
      assert.equal(response.status, 401);
      assert.deepEqual(await response.json(), { error: "unauthorized" });
    }
  }
});

test("purchase validation rejects malformed requests and always buys for the authenticated owner", async () => {
  const calls = [];
  const route = progressRoute("app/api/store/purchase/route.ts", "../../../", { account: { id: "owner" } }, {
    purchaseCardPack: async (...args) => { calls.push(args); return { coins: 50 }; },
  });
  for (const body of [null, [], {}, { operationId: "short", count: 1, collectionId: "ice" }, { operationId: crypto.randomUUID(), count: "1", collectionId: "ice" }]) {
    assert.equal((await route.POST(request("/api/store/purchase", body))).status, 400);
  }
  assert.deepEqual(calls, []);
  const id = crypto.randomUUID();
  assert.equal((await route.POST(request("/api/store/purchase", { operationId: id, count: 1, collectionId: "ice", userId: "victim", progressionVersion: 2 }))).status, 200);
  assert.deepEqual(calls, [["owner", id, 1, "ice", 2]]);
});

test("disabled legacy import returns server progress without consuming a forged local wallet", async () => {
  const calls = [];
  const route = progressRoute("app/api/progress/import/route.ts", "../../../", { account: { id: "owner" } }, {
    getPlayerProgress: async id => { calls.push(id); return { coins: 100 }; },
  });
  const response = await route.POST(request("/api/progress/import", { coins: 999999, unlockedKinds: ["place-more"] }));
  assert.deepEqual(await response.json(), { progress: { coins: 100 }, legacyImportDisabled: true });
  assert.deepEqual(calls, ["owner"]);
});
