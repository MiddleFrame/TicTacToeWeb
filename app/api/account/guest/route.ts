import {
  createGuestAccount,
  findAccountBySessionToken,
} from "../../../backend/accounts";
import {
  createSessionCookie,
  isSecureRequest,
  readSessionToken,
} from "../../../backend/session";

const PRIVATE_HEADERS = { "Cache-Control": "no-store" };

export async function POST(request: Request): Promise<Response> {
  const currentToken = readSessionToken(request.headers.get("cookie"));
  if (currentToken) {
    const currentAccount = await findAccountBySessionToken(currentToken);
    if (currentAccount) {
      return Response.json(
        { account: currentAccount },
        { headers: PRIVATE_HEADERS },
      );
    }
  }

  const created = await createGuestAccount();
  return Response.json(
    { account: created.account },
    {
      status: 201,
      headers: {
        ...PRIVATE_HEADERS,
        "Set-Cookie": createSessionCookie(
          created.sessionToken,
          isSecureRequest(request),
        ),
      },
    },
  );
}
