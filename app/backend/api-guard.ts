import type { D1Database } from "@cloudflare/workers-types";
import { apiJson } from "./responses";
import { apiRatePolicy, cleanRateLimits, clientRateSubject, consumeRateLimit, rateKey, RateDenialCache } from "./rate-limit";

const denials = new RateDenialCache();
let accepted = 0;

export async function guardApiRequest(
  request: Request,
  db: D1Database,
  waitUntil: (promise: Promise<unknown>) => void,
): Promise<Response | null> {
  const policy = apiRatePolicy(new URL(request.url).pathname, request.method);
  if (!policy) return null;
  try {
    const key = await rateKey(clientRateSubject(request, true), policy);
    const cached = denials.retryAfter(key);
    const result = cached ? { allowed: false, retryAfter: cached } : await consumeRateLimit(db, key, policy);
    if (!result.allowed) {
      if (!cached) denials.deny(key, result.retryAfter);
      return apiJson(request, { error: "rate-limited", retryAfter: result.retryAfter }, {
        status: 429,
        headers: { "Retry-After": String(result.retryAfter) },
      });
    }
    accepted += 1;
    if (accepted % 128 === 0) waitUntil(cleanRateLimits(db).catch(() => undefined));
    return null;
  } catch {
    return apiJson(request, { error: "api-temporarily-unavailable" }, {
      status: 503,
      headers: { "Retry-After": "30" },
    });
  }
}
