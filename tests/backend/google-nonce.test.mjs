import assert from "node:assert/strict";
import test from "node:test";
import { googleSessionNonce } from "../../app/backend/google-identity.ts";

test("binds Google credentials to the active session nonce", async () => {
  const first = await googleSessionNonce("a".repeat(64));
  const second = await googleSessionNonce("b".repeat(64));

  assert.equal(first.length, 43);
  assert.notEqual(first, second);
  assert.match(first, /^[A-Za-z0-9_-]+$/);
});
