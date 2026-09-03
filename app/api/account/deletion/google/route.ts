import { env } from "cloudflare:workers";
import { getRawDb } from "../../../../../db";
import { deletionGoogleAccount, issueDeletionTicket } from "../../../../backend/account-deletion";
import { readDeletionBody } from "../../../../backend/deletion-request";
import { googleSessionNonce, verifyGoogleIdToken } from "../../../../backend/google-identity";
import { apiJson, apiOptions } from "../../../../backend/responses";
import { createSessionToken, isSecureRequest } from "../../../../backend/session";

const COOKIE = "tttp_delete_nonce";

function nonceCookie(request: Request, value: string): string {
  return `${COOKIE}=${value}; Path=/api/account/deletion; HttpOnly; SameSite=Strict; Max-Age=${value ? 600 : 0}${isSecureRequest(request) ? "; Secure" : ""}`;
}

export async function GET(request: Request): Promise<Response> {
  const clientId = env.GOOGLE_AUTH_CLIENT_ID?.trim();
  if (!clientId) return apiJson(request, { error: "google-auth-unavailable" }, { status: 503 });
  const secret = createSessionToken();
  return apiJson(request, { clientId, nonce: await googleSessionNonce(secret) }, {
    headers: { "Set-Cookie": nonceCookie(request, secret) },
  });
}

export async function POST(request: Request): Promise<Response> {
  const input = await readDeletionBody(request);
  const secret = request.headers.get("cookie")?.split(";").map((part) => part.trim())
    .find((part) => part.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
  if (!secret || !/^[a-f0-9]{64}$/.test(secret) || typeof input?.idToken !== "string" || !env.GOOGLE_AUTH_CLIENT_ID) {
    return apiJson(request, { error: "google-verification-required" }, { status: 403 });
  }
  let subject: string;
  try {
    const identity = await verifyGoogleIdToken(input.idToken, env.GOOGLE_AUTH_CLIENT_ID.trim(), await googleSessionNonce(secret), true);
    subject = identity.subject;
  } catch {
    return apiJson(request, { error: "google-verification-required" }, { status: 403 });
  }
  const account = await deletionGoogleAccount(getRawDb(), subject);
  if (!account) return apiJson(request, { error: "account-not-found" }, { status: 404 });
  const ticket = await issueDeletionTicket(getRawDb(), account.id);
  return apiJson(request, {
    ticket,
    account: { publicCode: account.publicCode, nickname: account.nickname },
  }, { headers: { "Set-Cookie": nonceCookie(request, "") } });
}

export const OPTIONS = apiOptions;
