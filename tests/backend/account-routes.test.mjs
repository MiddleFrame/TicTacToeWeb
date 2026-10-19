import assert from "node:assert/strict";
import test from "node:test";
import * as responses from "../../app/backend/responses.ts";
import * as session from "../../app/backend/session.ts";
import * as deletion from "../../app/backend/account-deletion.ts";
import { readDeletionBody } from "../../app/backend/deletion-request.ts";
import { loadFrontendModule } from "../helpers/frontend-runtime.mjs";

const request = (body, native = false) => new Request("https://test.invalid/api/account/google", {
  method: "POST", headers: { "Content-Type": "application/json", ...(native ? { "x-tttp-client": "android" } : {}) }, body: JSON.stringify(body),
});

test("Google linking verifies the session nonce before linking, rotates the old token and exposes new bearer only to native clients", async () => {
  let authenticated = { account: { id: "owner" }, token: "old-token" };
  let accepted = true;
  const calls = [];
  const route = loadFrontendModule("app/api/account/google/route.ts", {
    "cloudflare:workers": { env: { GOOGLE_AUTH_CLIENT_ID: "client" } },
    "../../../backend/accounts": {
      getGoogleIdentity: async () => null,
      connectGoogleIdentity: async (...args) => { calls.push(["link", ...args]); return { userId: "linked-owner", sessionToken: "new-token", switched: true }; },
      revokeSession: async token => calls.push(["revoke", token]),
    },
    "../../../backend/google-identity": {
      googleSessionNonce: async token => `nonce:${token}`,
      verifyGoogleIdToken: async (...args) => { calls.push(["verify", ...args]); if (!accepted) throw new Error("invalid"); return { subject: "verified-subject", email: "owner@example.com" }; },
    },
    "../../../backend/progress": { getPlayerProgress: async id => ({ accountId: id }) },
    "../../../backend/request-session": { authenticateRequest: async () => authenticated },
    "../../../backend/responses": responses, "../../../backend/session": session,
  });
  authenticated = null;
  assert.equal((await route.POST(request({ idToken: "signed" }))).status, 401);
  assert.deepEqual(calls, []);
  authenticated = { account: { id: "owner" }, token: "old-token" };
  assert.equal((await route.POST(request({ idToken: 123 }))).status, 400);
  assert.deepEqual(calls, []);
  accepted = false;
  assert.equal((await route.POST(request({ idToken: "invalid" }))).status, 401);
  assert.equal(calls.filter(c => c[0] === "link" || c[0] === "revoke").length, 0);
  accepted = true; calls.length = 0;
  const native = await route.POST(request({ idToken: "signed", userId: "victim", email: "attacker@example.com" }, true));
  assert.equal(native.status, 200);
  assert.deepEqual(calls, [["verify", "signed", "client", "nonce:old-token"], ["link", "owner", "verified-subject", "owner@example.com"], ["revoke", "old-token"]]);
  assert.equal((await native.json()).sessionToken, "new-token");
  assert.match(native.headers.get("Set-Cookie"), /tttp_session=new-token/);
  assert.equal((await (await route.POST(request({ idToken: "signed" }))).json()).sessionToken, undefined);
});

test("deletion confirmation cannot issue a ticket for another public code or Google subject", async () => {
  let subject = "wrong-subject";
  const issued = [];
  const verified = [];
  const route = loadFrontendModule("app/api/account/deletion/route.ts", {
    "cloudflare:workers": { env: { GOOGLE_AUTH_CLIENT_ID: "client" } }, "../../../../db": { getRawDb: () => ({}) },
    "../../../backend/account-deletion": { ...deletion,
      deletionSessionAccount: async () => ({ id: "owner", publicCode: "ABCDEFGH23", googleSubject: "owner-subject" }),
      issueDeletionTicket: async (_db, id) => { issued.push(id); return "ticket"; },
    },
    "../../../backend/deletion-request": { readDeletionBody },
    "../../../backend/google-identity": {
      googleSessionNonce: async () => "bound-nonce",
      verifyGoogleIdToken: async (...args) => { verified.push(args); return { subject }; },
    },
    "../../../backend/request-session": { readRequestSessionToken: () => "session" },
    "../../../backend/responses": responses, "../../../backend/session": session,
  });
  assert.equal((await route.POST(request({ confirm: "DELETE", publicCode: "ABCDEFGH24", idToken: "signed" }))).status, 400);
  assert.deepEqual(verified, []);
  assert.equal((await route.POST(request({ confirm: "DELETE", publicCode: "ABCDEFGH23", idToken: "signed" }))).status, 403);
  assert.deepEqual(issued, []);
  assert.deepEqual(verified, [["signed", "client", "bound-nonce", true]]);
  subject = "owner-subject";
  assert.equal((await route.POST(request({ confirm: "DELETE", publicCode: "ABCDEFGH23", idToken: "signed" }))).status, 200);
  assert.deepEqual(issued, ["owner"]);
});
