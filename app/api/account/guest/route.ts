import {
  createGuestAccount,
  findAccountBySessionToken,
} from "../../../backend/accounts";
import {
  createSessionCookie,
  isSecureRequest,
  readSessionToken,
} from "../../../backend/session";
import { apiJson, apiOptions } from "../../../backend/responses";

export async function POST(request: Request): Promise<Response> {
  const currentToken = readSessionToken(request.headers.get("cookie"));
  if (currentToken) {
    const currentAccount = await findAccountBySessionToken(currentToken);
    if (currentAccount) {
      return apiJson(
        request,
        { account: currentAccount },
      );
    }
  }

  const created = await createGuestAccount();
  const nativeClient = request.headers.get("x-tttp-client") === "android";
  return apiJson(
    request,
    {
      account: created.account,
      ...(nativeClient ? { sessionToken: created.sessionToken } : {}),
    },
    {
      status: 201,
      headers: {
        "Set-Cookie": createSessionCookie(
          created.sessionToken,
          isSecureRequest(request),
        ),
      },
    },
  );
}

export const OPTIONS = apiOptions;
