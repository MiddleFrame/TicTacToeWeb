import { createRemoteJWKSet, jwtVerify } from "jose";

const GOOGLE_ISSUERS = ["accounts.google.com", "https://accounts.google.com"];
const GOOGLE_JWKS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs"),
);

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function googleSessionNonce(sessionToken: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`tttp-google:${sessionToken}`),
  );
  return base64Url(new Uint8Array(digest));
}

export async function verifyGoogleIdToken(
  idToken: string,
  clientId: string,
  expectedNonce: string,
): Promise<{ subject: string; email: string | null }> {
  const { payload } = await jwtVerify(idToken, GOOGLE_JWKS, {
    algorithms: ["RS256"],
    audience: clientId,
    issuer: GOOGLE_ISSUERS,
  });
  if (typeof payload.sub !== "string" || !payload.sub) {
    throw new Error("google-subject-missing");
  }
  if (payload.nonce !== expectedNonce) {
    throw new Error("google-nonce-invalid");
  }
  const email = payload.email_verified === true && typeof payload.email === "string"
    ? payload.email.trim().slice(0, 320) || null
    : null;
  return { subject: payload.sub, email };
}
