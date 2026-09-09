import assert from "node:assert/strict";
import test from "node:test";
import { deferred, memoryStorage, loadHook } from "./helpers/hook-harness.mjs";
import * as cache from "../app/game/account-cache.ts";
import * as queue from "../app/game/progress-operation-queue.ts";
import * as errors from "../app/game/progress-request-error.ts";
import * as timeout from "../app/game/request-timeout.ts";
import * as curve from "../app/game/progression-curve.ts";
import { cacheLocalPlayerProgress, initialLocalPlayerProgress } from "../app/game/local-player-progress.ts";

function clientFixture() {
  const storage = memoryStorage();
  let server = { ...initialLocalPlayerProgress(), accountId: "account-a" };
  let progressGets = 0;
  let requests = 0;
  let responder = null;
  const plugins = {
    SecureSession: { getToken: async () => ({ value: "synthetic-test-token" }), setToken: async () => {}, removeToken: async () => {} },
    GoogleAuth: { signIn: async () => ({ idToken: "synthetic-test-proof" }), isAvailable: async () => ({ available: true }) },
  };
  const client = loadHook("app/game/player-progress-client.ts", {
    "@capacitor/core": { Capacitor: { getPlatform: () => "android" }, registerPlugin: (name) => plugins[name] },
    "./account-cache": cache,
    "./progress-operation-queue": queue,
    "./progress-request-error": errors,
    "./request-timeout": timeout,
    "./progression-curve": curve,
  }, {
    window: { localStorage: storage },
    process: { env: { NEXT_PUBLIC_API_ORIGIN: "https://test.invalid" } },
    async fetch(url, options) {
      requests++;
      if (responder) return responder(url, options);
      if (url.endsWith("/api/progress")) { progressGets++; return Response.json({ progress: server }); }
      if (url.endsWith("/api/account/google") && options.method === "POST") {
        server = { ...server, accountId: "account-b", coins: 700 };
        return Response.json({ progress: server, sessionToken: "synthetic-b", email: null, linked: true, switched: true });
      }
      if (url.endsWith("/api/account/google")) return Response.json({ configured: true, nonce: "test-nonce", linked: false, email: null });
      assert.fail(`Unexpected synthetic URL: ${url}`);
    },
  });
  return { client, storage, plugins, get progressGets() { return progressGets; }, get requests() { return requests; }, setServer: (next) => { server = next; }, get server() { return server; }, respond: (next) => { responder = next; } };
}

test("initialization deduplicates only inflight calls; reconnect fetches the current balance", async () => {
  const fixture = clientFixture();
  const first = fixture.client.initializePlayerProgress();
  assert.equal(fixture.client.initializePlayerProgress(), first);
  assert.equal((await first).coins, 220);
  fixture.setServer({ ...fixture.server, coins: 170 });
  assert.equal((await fixture.client.initializePlayerProgress()).coins, 170);
  assert.equal(fixture.progressGets, 2);
});

test("A to B then reconnect cannot restore A's cached initialization", async () => {
  const fixture = clientFixture();
  await fixture.client.initializePlayerProgress();
  await fixture.client.connectGoogleAccount();
  const reconnected = await fixture.client.initializePlayerProgress();
  assert.equal(reconnected.accountId, "account-b");
  assert.equal(reconnected.coins, 700);
  assert.equal(fixture.storage.getItem("tttp-cloud-account"), "account-b");
});

test("late response bodies from a rotated session are rejected", async () => {
  const fixture = clientFixture();
  await fixture.client.initializePlayerProgress();
  const body = deferred();
  fixture.respond(async () => ({ ok: true, json: () => body.promise }));
  const late = fixture.client.refreshCloudPlayerProgress();
  for (let i = 0; i < 4; i++) await Promise.resolve();
  fixture.respond(null);
  await fixture.client.connectGoogleAccount();
  body.resolve({ progress: { ...fixture.server, accountId: "account-a" } });
  await assert.rejects(late, /session-changed/);
});

test("late error bodies cannot classify a new session using the old session's rejection", async () => {
  const fixture = clientFixture();
  await fixture.client.initializePlayerProgress();
  const body = deferred();
  fixture.respond(async () => ({ ok: false, status: 401, headers: new Headers(), json: () => body.promise }));
  const late = fixture.client.refreshCloudPlayerProgress();
  for (let index = 0; index < 8; index++) await Promise.resolve();
  fixture.respond(null);
  await fixture.client.connectGoogleAccount();
  body.resolve({ error: "unauthorized" });
  await assert.rejects(late, /session-changed/);
});

test("deletion during native token persistence prevents late account cache adoption", async () => {
  const fixture = clientFixture();
  await fixture.client.initializePlayerProgress();
  const started = deferred();
  const persisted = deferred();
  fixture.plugins.SecureSession.setToken = () => { started.resolve(); return persisted.promise; };
  const connecting = fixture.client.connectGoogleAccount();
  await started.promise;
  await fixture.client.clearDeletedAccount();
  persisted.resolve();
  await assert.rejects(connecting, /session-changed/);
  assert.equal(fixture.storage.getItem("tttp-cloud-account"), null);
  assert.equal(fixture.storage.getItem("tttp-local-progress-v2"), null);
});

test("an expired session with pending operations never creates a guest or erases the queue", async () => {
  const fixture = clientFixture();
  await fixture.client.initializePlayerProgress();
  const operation = { id: crypto.randomUUID(), type: "reward-ad" };
  queue.enqueueProgressOperation(fixture.storage, operation);
  fixture.respond(async (url) => { assert.ok(url.endsWith("/api/progress")); return Response.json({ error: "unauthorized" }, { status: 401 }); });
  await assert.rejects(fixture.client.initializePlayerProgress(), /account-session-expired/);
  assert.deepEqual(queue.readProgressOperations(fixture.storage), [operation]);
  assert.equal(fixture.storage.getItem("tttp-cloud-account"), "account-a");
});

test("a known account with an empty queue is never silently replaced after expiry", async () => {
  const fixture = clientFixture();
  await fixture.client.initializePlayerProgress();
  cacheLocalPlayerProgress(fixture.storage, fixture.server);
  let guestRequests = 0;
  fixture.respond(async (url) => {
    if (url.endsWith("/api/account/guest")) guestRequests++;
    return Response.json({ error: "unauthorized" }, { status: 401 });
  });
  await assert.rejects(fixture.client.initializePlayerProgress(), /account-session-expired/);
  assert.equal(guestRequests, 0);
  assert.equal(fixture.storage.getItem("tttp-cloud-account"), "account-a");
  assert.equal(JSON.parse(fixture.storage.getItem("tttp-local-progress-v2")).accountId, "account-a");
});

test("native Google availability remains discoverable when the existing session expired", async () => {
  const fixture = clientFixture();
  fixture.respond(async () => Response.json({ error: "unauthorized" }, { status: 401 }));
  const status = await fixture.client.getGoogleAccountState();
  assert.equal(status.available, true);
  assert.equal(status.linked, false);
  assert.equal(status.email, null);
});

async function recoveryFixture() {
  const fixture = clientFixture();
  await fixture.client.initializePlayerProgress();
  cacheLocalPlayerProgress(fixture.storage, { ...fixture.server, coins: 270 });
  let token = "expired";
  let target = "account-a";
  let guestRequests = 0;
  const writes = [];
  fixture.plugins.SecureSession.getToken = async () => ({ value: token });
  fixture.plugins.SecureSession.setToken = async ({ value }) => { token = value; };
  fixture.respond(async (url, options) => {
    if (url.endsWith("/api/account/guest")) {
      guestRequests++;
      return Response.json({ sessionToken: "temporary-guest" });
    }
    if (token === "expired") return Response.json({ error: "unauthorized" }, { status: 401 });
    if (url.endsWith("/api/account/google") && options.method === "POST") {
      return Response.json({
        progress: { ...fixture.server, accountId: target }, sessionToken: target,
        linked: true, switched: true, email: null,
      });
    }
    if (url.endsWith("/api/account/google")) return Response.json({ configured: true, nonce: "synthetic-nonce", linked: true, email: null });
    if (url.endsWith("/api/progress")) return Response.json({ progress: { ...fixture.server, accountId: token } });
    writes.push({ url, token });
    throw new Error("Unexpected progression write during recovery");
  });
  return { ...fixture, writes, target: (value) => { target = value; }, token: () => token, guestRequests: () => guestRequests };
}

test("explicit Google recovery retains pending operations and the local snapshot for the same account", async () => {
  const fixture = await recoveryFixture();
  const operation = { id: crypto.randomUUID(), type: "reward-ad" };
  queue.enqueueProgressOperation(fixture.storage, operation);
  await assert.rejects(fixture.client.initializePlayerProgress(), /account-session-expired/);
  const connected = await fixture.client.connectGoogleAccount();
  assert.equal(connected.progress.accountId, "account-a");
  assert.equal(fixture.guestRequests(), 1);
  assert.equal(fixture.token(), "account-a");
  assert.deepEqual(queue.readProgressOperations(fixture.storage), [operation]);
  assert.equal(JSON.parse(fixture.storage.getItem("tttp-local-progress-v2")).coins, 270);
  assert.equal((await fixture.client.initializePlayerProgress()).accountId, "account-a");
  assert.deepEqual(fixture.writes, []);
});

test("the wrong Google account cannot adopt a pending queue and the owner can still recover", async () => {
  const fixture = await recoveryFixture();
  const operation = { id: crypto.randomUUID(), type: "reward-ad" };
  queue.enqueueProgressOperation(fixture.storage, operation);
  fixture.target("account-b");
  await assert.rejects(fixture.client.connectGoogleAccount(), /account-progress-conflict/);
  assert.equal(fixture.token(), "account-b");
  assert.equal(fixture.storage.getItem("tttp-cloud-account"), "account-a");
  assert.equal(JSON.parse(fixture.storage.getItem("tttp-local-progress-v2")).coins, 270);
  await assert.rejects(fixture.client.initializePlayerProgress(), /account-progress-conflict/);
  assert.deepEqual(queue.readProgressOperations(fixture.storage), [operation]);
  fixture.target("account-a");
  assert.equal((await fixture.client.connectGoogleAccount()).progress.accountId, "account-a");
  assert.equal(fixture.token(), "account-a");
  assert.deepEqual(queue.readProgressOperations(fixture.storage), [operation]);
  assert.deepEqual(fixture.writes, []);
});

test("explicit Google recovery may adopt another account when no pending operations exist", async () => {
  const fixture = await recoveryFixture();
  fixture.target("account-b");
  assert.equal((await fixture.client.connectGoogleAccount()).progress.accountId, "account-b");
  assert.equal(fixture.storage.getItem("tttp-cloud-account"), "account-b");
  assert.deepEqual(queue.readProgressOperations(fixture.storage), []);
});

test("HTTP status and Retry-After survive the transport boundary", async () => {
  const fixture = clientFixture();
  fixture.respond(async () => Response.json({ error: "reward-rate-limited" }, { status: 429, headers: { "Retry-After": "75" } }));
  await assert.rejects(fixture.client.grantCloudAdReward(crypto.randomUUID()), (error) => {
    assert.equal(error.status, 429);
    assert.equal(error.retryAfterMs, 75_000);
    return true;
  });
});

test("request deadlines abort stalled fetches and honor an already cancelled caller", async () => {
  await assert.rejects(timeout.withRequestDeadline((signal) => new Promise((resolve, reject) => {
    signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
  }), null, 5), /aborted/);
  const parent = new AbortController();
  parent.abort();
  await timeout.withRequestDeadline(async (signal) => assert.equal(signal.aborted, true), parent.signal);
});
