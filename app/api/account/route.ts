import { revokeSession } from "../../backend/accounts";
import {
  clearSessionCookie,
  isSecureRequest,
} from "../../backend/session";
import { authenticateRequest, readRequestSessionToken } from "../../backend/request-session";
import { apiEmpty, apiJson, apiOptions } from "../../backend/responses";

export async function GET(request: Request): Promise<Response> {
  const authenticated = await authenticateRequest(request);
  if (!authenticated) {
    return apiJson(
      request,
      { error: "unauthorized" },
      {
        status: 401,
        headers: {
          "Set-Cookie": clearSessionCookie(isSecureRequest(request)),
        },
      },
    );
  }
  return apiJson(request, { account: authenticated.account });
}

export async function DELETE(request: Request): Promise<Response> {
  const token = readRequestSessionToken(request);
  if (token) await revokeSession(token);
  const response = apiEmpty(request);
  response.headers.set("Set-Cookie", clearSessionCookie(isSecureRequest(request)));
  return response;
}

export const OPTIONS = apiOptions;
