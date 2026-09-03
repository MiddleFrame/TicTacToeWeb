import { env } from "cloudflare:workers";
import { getGoogleIdentity } from "./accounts";
import { isAdminEmail } from "./admin-policy";
import { authenticateRequest } from "./request-session";

export function adminJson(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Vary": "Cookie, Authorization",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}

export async function requireAdmin(request: Request) {
  if (!env.ADMIN_GOOGLE_EMAILS?.trim()) return adminJson({ error: "admin-disabled" }, 403);
  const authenticated = await authenticateRequest(request);
  if (!authenticated) return adminJson({ error: "unauthorized" }, 401);
  const identity = await getGoogleIdentity(authenticated.account.id);
  if (!isAdminEmail(identity?.email, env.ADMIN_GOOGLE_EMAILS)) {
    return adminJson({ error: "admin-forbidden" }, 403);
  }
  return authenticated.account;
}
