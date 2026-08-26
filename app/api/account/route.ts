import { findAccountBySessionToken, revokeSession } from "../../backend/accounts";
import {
  clearSessionCookie,
  isSecureRequest,
  readSessionToken,
} from "../../backend/session";

const PRIVATE_HEADERS = { "Cache-Control": "no-store" };

export async function GET(request: Request): Promise<Response> {
  const token = readSessionToken(request.headers.get("cookie"));
  if (!token) {
    return Response.json(
      { error: "unauthorized" },
      { status: 401, headers: PRIVATE_HEADERS },
    );
  }

  const account = await findAccountBySessionToken(token);
  if (!account) {
    return Response.json(
      { error: "unauthorized" },
      {
        status: 401,
        headers: {
          ...PRIVATE_HEADERS,
          "Set-Cookie": clearSessionCookie(isSecureRequest(request)),
        },
      },
    );
  }

  return Response.json({ account }, { headers: PRIVATE_HEADERS });
}

export async function DELETE(request: Request): Promise<Response> {
  const token = readSessionToken(request.headers.get("cookie"));
  if (token) await revokeSession(token);
  return new Response(null, {
    status: 204,
    headers: {
      ...PRIVATE_HEADERS,
      "Set-Cookie": clearSessionCookie(isSecureRequest(request)),
    },
  });
}
