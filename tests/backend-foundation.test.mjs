import assert from "node:assert/strict";
import test from "node:test";
import {
  clearSessionCookie,
  createPublicCode,
  createSessionCookie,
  createSessionToken,
  hashSessionToken,
  isSecureRequest,
  readSessionToken,
  sessionExpiresAt,
} from "../app/backend/session.ts";

test("creates opaque session tokens and stable hashes", async () => {
  const first = createSessionToken();
  const second = createSessionToken();

  assert.match(first, /^[a-f0-9]{64}$/);
  assert.match(second, /^[a-f0-9]{64}$/);
  assert.notEqual(first, second);
  assert.equal(await hashSessionToken(first), await hashSessionToken(first));
  assert.notEqual(await hashSessionToken(first), await hashSessionToken(second));
});

test("reads only valid game session cookies", () => {
  const token = "a".repeat(64);

  assert.equal(readSessionToken(`theme=dark; tttp_session=${token}`), token);
  assert.equal(readSessionToken("tttp_session=broken"), null);
  assert.equal(readSessionToken(null), null);
});

test("creates secure production cookies and removable cookies", () => {
  const token = "b".repeat(64);
  const cookie = createSessionCookie(token, true);
  const cleared = clearSessionCookie(true);

  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Lax/);
  assert.match(cookie, /Max-Age=2592000/);
  assert.match(cookie, /Secure/);
  assert.match(cleared, /Max-Age=0/);
});

test("creates readable public codes without ambiguous characters", () => {
  const code = createPublicCode();

  assert.match(code, /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{10}$/);
});

test("expires guest sessions after thirty days", () => {
  const now = new Date("2026-08-26T00:00:00.000Z");

  assert.equal(
    sessionExpiresAt(now).toISOString(),
    "2026-09-25T00:00:00.000Z",
  );
});

test("detects secure requests for cookie attributes", () => {
  assert.equal(isSecureRequest(new Request("https://game.example")), true);
  assert.equal(isSecureRequest(new Request("http://localhost:3000")), false);
});
