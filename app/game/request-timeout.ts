export async function withRequestDeadline<T>(
  request: (signal: AbortSignal) => Promise<T>,
  parentSignal?: AbortSignal | null,
  timeoutMs = 20_000,
): Promise<T> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (parentSignal?.aborted) abort();
  else parentSignal?.addEventListener("abort", abort, { once: true });
  const timeout = setTimeout(abort, timeoutMs);
  try {
    return await request(controller.signal);
  } finally {
    clearTimeout(timeout);
    parentSignal?.removeEventListener("abort", abort);
  }
}
