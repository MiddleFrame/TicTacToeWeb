export class ProgressRequestError extends Error {
  readonly status: number;
  readonly retryAfterMs: number | null;

  constructor(message: string, status: number, retryAfterMs: number | null = null) {
    super(message);
    this.name = "ProgressRequestError";
    this.status = status;
    this.retryAfterMs = retryAfterMs;
  }
}

export type ProgressSyncState = "restoring" | "syncing" | "ready" | "offline" | "conflict" | "auth-required" | "rate-limited";

export function parseRetryAfter(value: string | null, now = Date.now()): number | null {
  if (!value) return null;
  const seconds = /^\d+$/.test(value) ? Number(value) : null;
  const delay = seconds === null ? Date.parse(value) - now : seconds * 1000;
  return Number.isFinite(delay) ? Math.max(0, delay) : null;
}

export function classifyProgressError(error: unknown): ProgressSyncState {
  if (!(error instanceof ProgressRequestError)) return "offline";
  if (error.status === 401 || error.status === 403) return "auth-required";
  if (error.message === "progress-busy" || error.status >= 500 || error.status === 408) return "offline";
  if (error.status === 429) return "rate-limited";
  return "conflict";
}

export function progressRetryDelay(error: unknown, attempt: number, random = Math.random): number | null {
  const state = classifyProgressError(error);
  if (state !== "offline" && state !== "rate-limited") return null;
  const backoff = Math.min(60_000, 1000 * 2 ** Math.min(attempt, 6));
  const retryAfter = error instanceof ProgressRequestError ? error.retryAfterMs ?? 0 : 0;
  const quotaFallback = error instanceof ProgressRequestError && error.message === "reward-rate-limited" && error.retryAfterMs === null ? 3_600_000 : 0;
  return Math.max(retryAfter, quotaFallback, Math.round(backoff * (0.75 + random() * 0.5)));
}
