import { findAccountBySessionToken, type AccountSnapshot } from "./accounts";
import { readSessionToken } from "./session";

function readBearerToken(authorization: string | null): string | null {
  if (!authorization) return null;
  const match = authorization.match(/^Bearer ([a-f0-9]{64})$/i);
  return match?.[1].toLowerCase() ?? null;
}

export function readRequestSessionToken(request: Request): string | null {
  return readBearerToken(request.headers.get("authorization"))
    ?? readSessionToken(request.headers.get("cookie"));
}

export async function authenticateRequest(request: Request): Promise<{
  account: AccountSnapshot;
  token: string;
} | null> {
  const token = readRequestSessionToken(request);
  if (!token) return null;
  const account = await findAccountBySessionToken(token);
  return account ? { account, token } : null;
}
