import { env } from "cloudflare:workers";
import {
  connectGoogleIdentity,
  getGoogleIdentity,
  revokeSession,
} from "../../../backend/accounts";
import { googleSessionNonce, verifyGoogleIdToken } from "../../../backend/google-identity";
import { getPlayerProgress } from "../../../backend/progress";
import { authenticateRequest } from "../../../backend/request-session";
import { apiJson, apiOptions } from "../../../backend/responses";
import { createSessionCookie, isSecureRequest } from "../../../backend/session";

function clientId(): string {
  return env.GOOGLE_AUTH_CLIENT_ID?.trim() ?? "";
}

export async function GET(request: Request): Promise<Response> {
  const authenticated = await authenticateRequest(request);
  if (!authenticated) {
    return apiJson(request, { error: "unauthorized" }, { status: 401 });
  }
  const configured = Boolean(clientId());
  const identity = await getGoogleIdentity(authenticated.account.id);
  return apiJson(request, {
    configured,
    linked: Boolean(identity),
    email: identity?.email ?? null,
    nonce: configured ? await googleSessionNonce(authenticated.token) : null,
  });
}

export async function POST(request: Request): Promise<Response> {
  const authenticated = await authenticateRequest(request);
  if (!authenticated) {
    return apiJson(request, { error: "unauthorized" }, { status: 401 });
  }
  const audience = clientId();
  if (!audience) {
    return apiJson(request, { error: "google-auth-unavailable" }, { status: 503 });
  }
  const input = await request.json().catch(() => null) as { idToken?: unknown } | null;
  if (typeof input?.idToken !== "string" || input.idToken.length > 8192) {
    return apiJson(request, { error: "google-token-invalid" }, { status: 400 });
  }
  try {
    const expectedNonce = await googleSessionNonce(authenticated.token);
    const identity = await verifyGoogleIdToken(input.idToken, audience, expectedNonce);
    const connected = await connectGoogleIdentity(
      authenticated.account.id,
      identity.subject,
      identity.email,
    );
    await revokeSession(authenticated.token);
    const nativeClient = request.headers.get("x-tttp-client") === "android";
    return apiJson(
      request,
      {
        linked: true,
        email: identity.email,
        switched: connected.switched,
        progress: await getPlayerProgress(connected.userId),
        ...(nativeClient ? { sessionToken: connected.sessionToken } : {}),
      },
      {
        headers: {
          "Set-Cookie": createSessionCookie(
            connected.sessionToken,
            isSecureRequest(request),
          ),
        },
      },
    );
  } catch {
    return apiJson(request, { error: "google-token-invalid" }, { status: 401 });
  }
}

export const OPTIONS = apiOptions;
