import { env } from "cloudflare:workers";
import { getRawDb } from "../../../../db";
import { deletionInput, deletionSessionAccount, deleteAccountWithTicket, issueDeletionTicket } from "../../../backend/account-deletion";
import { readDeletionBody } from "../../../backend/deletion-request";
import { googleSessionNonce, verifyGoogleIdToken } from "../../../backend/google-identity";
import { readRequestSessionToken } from "../../../backend/request-session";
import { apiJson, apiOptions } from "../../../backend/responses";
import { clearSessionCookie, isSecureRequest } from "../../../backend/session";

async function currentAccount(request: Request) {
  const token = readRequestSessionToken(request);
  const account = token ? await deletionSessionAccount(getRawDb(), token) : null;
  return token && account ? { account, token } : null;
}

export async function GET(request: Request): Promise<Response> {
  const current = await currentAccount(request);
  if (!current) return apiJson(request, { error: "unauthorized" }, { status: 401 });
  return apiJson(request, {
    account: { publicCode: current.account.publicCode, nickname: current.account.nickname },
    googleRequired: Boolean(current.account.googleSubject),
    clientId: env.GOOGLE_AUTH_CLIENT_ID?.trim() || null,
    nonce: await googleSessionNonce(current.token),
  });
}

export async function POST(request: Request): Promise<Response> {
  const current = await currentAccount(request);
  if (!current) return apiJson(request, { error: "unauthorized" }, { status: 401 });
  const input = await readDeletionBody(request);
  if (input?.confirm !== "DELETE" || input.publicCode !== current.account.publicCode) {
    return apiJson(request, { error: "deletion-confirmation-required" }, { status: 400 });
  }
  if (current.account.googleSubject) {
    try {
      if (typeof input.idToken !== "string" || !env.GOOGLE_AUTH_CLIENT_ID) throw new Error("google-required");
      const identity = await verifyGoogleIdToken(input.idToken, env.GOOGLE_AUTH_CLIENT_ID.trim(), await googleSessionNonce(current.token), true);
      if (identity.subject !== current.account.googleSubject) throw new Error("google-account-mismatch");
    } catch {
      return apiJson(request, { error: "google-verification-required" }, { status: 403 });
    }
  }
  const ticket = await issueDeletionTicket(getRawDb(), current.account.id);
  return apiJson(request, { ticket });
}

export async function DELETE(request: Request): Promise<Response> {
  const input = deletionInput(await readDeletionBody(request));
  if (!input) return apiJson(request, { error: "deletion-confirmation-required" }, { status: 400 });
  const current = await currentAccount(request);
  const deletedId = await deleteAccountWithTicket(getRawDb(), input.ticket, input.publicCode);
  if (!deletedId) return apiJson(request, { error: "deletion-expired" }, { status: 410 });
  const clearLocalSession = current?.account.id === deletedId;
  return apiJson(request, { deleted: true, clearLocalSession }, {
    headers: clearLocalSession ? { "Set-Cookie": clearSessionCookie(isSecureRequest(request)) } : {},
  });
}

export const OPTIONS = apiOptions;
