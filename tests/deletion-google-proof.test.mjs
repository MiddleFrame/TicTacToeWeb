import assert from "node:assert/strict";
import test from "node:test";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { verifyGoogleIdToken } from "../app/backend/google-identity.ts";

test("deletion requires a signed, recent Google credential with the exact issuer, audience and nonce", async () => {
  const { privateKey, publicKey } = await generateKeyPair("RS256");
  const key = { ...await exportJWK(publicKey), kid: "deletion-test", alg: "RS256", use: "sig" };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    assert.equal(String(input), "https://www.googleapis.com/oauth2/v3/certs");
    return Response.json({ keys: [key] });
  };
  const now = Math.floor(Date.now() / 1000);
  const sign = (payload = {}, iat = now) => new SignJWT({ sub: "owner-subject", nonce: "bound-nonce", email: "owner@example.com", email_verified: true, ...payload })
    .setProtectedHeader({ alg: "RS256", kid: key.kid })
    .setIssuer("https://accounts.google.com").setAudience("client-id").setIssuedAt(iat).setExpirationTime(now + 3600).sign(privateKey);
  try {
    const valid = await sign();
    assert.deepEqual(await verifyGoogleIdToken(valid, "client-id", "bound-nonce", true), { subject: "owner-subject", email: "owner@example.com" });
    await assert.rejects(verifyGoogleIdToken(valid, "wrong-client", "bound-nonce", true));
    await assert.rejects(verifyGoogleIdToken(valid, "client-id", "wrong-nonce", true));
    await assert.rejects(verifyGoogleIdToken(await sign({}, now - 600), "client-id", "bound-nonce", true));
    await assert.rejects(verifyGoogleIdToken(await sign({}, now + 600), "client-id", "bound-nonce", true));
    const parts = valid.split(".");
    parts[1] = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(parts[1], "base64url")), sub: "another-player" })).toString("base64url");
    await assert.rejects(verifyGoogleIdToken(parts.join("."), "client-id", "bound-nonce", true));
    const unsigned = `${parts[0]}.${parts[1]}.`;
    await assert.rejects(verifyGoogleIdToken(unsigned, "client-id", "bound-nonce", true));
  } finally {
    globalThis.fetch = originalFetch;
  }
});
