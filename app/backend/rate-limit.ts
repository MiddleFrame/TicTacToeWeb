import type { D1Database } from "@cloudflare/workers-types";

export type RatePolicy = { name: string; limit: number; windowMs: number };
export type RateDecision = { allowed: boolean; retryAfter: number };

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

export function apiRatePolicy(pathname: string, method: string): RatePolicy | null {
  if (!pathname.startsWith("/api/") || method === "OPTIONS") return null;
  const path = pathname.replace(/\/+$/, "");
  if (path === "/api/account/guest" && method === "POST") {
    return { name: "guest", limit: 10, windowMs: 10 * MINUTE };
  }
  if (path === "/api/account/google" && method === "POST") {
    return { name: "google", limit: 15, windowMs: 10 * MINUTE };
  }
  if (path.startsWith("/api/admin/")) {
    return { name: "admin", limit: 60, windowMs: MINUTE };
  }
  return method === "GET" || method === "HEAD"
    ? { name: "read", limit: 240, windowMs: MINUTE }
    : { name: "write", limit: 90, windowMs: MINUTE };
}

export function clientRateSubject(request: Request, trustCloudflareHeader = false): string {
  const cf = (request as Request & { cf?: { colo?: unknown } }).cf;
  const address = request.headers.get("cf-connecting-ip");
  if ((!trustCloudflareHeader && typeof cf?.colo !== "string") || !address || address.length > 64) return "unknown-client";
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(address)) return address;
  if (/^[\da-f:]+$/i.test(address) && address.includes(":")) {
    const normalized = new URL(`http://[${address}]/`).hostname.slice(1, -1);
    const [head, tail = ""] = normalized.split("::");
    const left = head ? head.split(":") : [];
    const right = tail ? tail.split(":") : [];
    const parts = normalized.includes("::")
      ? [...left, ...Array(8 - left.length - right.length).fill("0"), ...right]
      : left;
    return `${parts.slice(0, 4).join(":")}/64`;
  }
  return "unknown-client";
}

export async function rateKey(subject: string, policy: RatePolicy): Promise<string> {
  const bytes = new TextEncoder().encode(`tttp-api-v1:${policy.name}:${subject}`);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function consumeRateLimit(
  db: Pick<D1Database, "prepare">,
  key: string,
  policy: RatePolicy,
  now = Date.now(),
): Promise<RateDecision> {
  const resetAt = (Math.floor(now / policy.windowMs) + 1) * policy.windowMs;
  const row = await db.prepare(`
    INSERT INTO api_rate_limits (key, hits, reset_at) VALUES (?1, 1, ?2)
    ON CONFLICT(key) DO UPDATE SET
      hits = CASE WHEN reset_at <= ?3 THEN 1 ELSE hits + 1 END,
      reset_at = CASE WHEN reset_at <= ?3 THEN excluded.reset_at ELSE reset_at END
    WHERE reset_at <= ?3 OR hits < ?4
    RETURNING hits
  `).bind(key, resetAt, now, policy.limit).first<{ hits: number }>();
  return { allowed: row !== null, retryAfter: Math.max(1, Math.ceil((resetAt - now) / 1000)) };
}

export async function cleanRateLimits(db: Pick<D1Database, "prepare">, now = Date.now()): Promise<void> {
  await db.prepare(`
    DELETE FROM api_rate_limits WHERE key IN (
      SELECT key FROM api_rate_limits WHERE reset_at < ?1 ORDER BY reset_at LIMIT 128
    )
  `).bind(now - DAY).run();
}

export class RateDenialCache {
  private entries = new Map<string, number>();

  retryAfter(key: string, now = Date.now()): number {
    const until = this.entries.get(key) ?? 0;
    if (until <= now) this.entries.delete(key);
    return Math.max(0, Math.ceil((until - now) / 1000));
  }

  deny(key: string, retryAfter: number, now = Date.now()): void {
    if (this.entries.size >= 2048) this.entries.delete(this.entries.keys().next().value!);
    this.entries.set(key, now + retryAfter * 1000);
  }
}
