export function isDeletionJsonRequest(request: Request): boolean {
  return request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() === "application/json";
}

export async function readDeletionBody(request: Request): Promise<Record<string, unknown> | null> {
  if (!isDeletionJsonRequest(request)) return null;
  const reader = request.body?.getReader();
  if (!reader) return null;
  let text = "";
  let bytes = 0;
  const decoder = new TextDecoder();
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > 12_000) { await reader.cancel(); return null; }
      text += decoder.decode(chunk.value, { stream: true });
    }
    const value = JSON.parse(text + decoder.decode());
    return value && typeof value === "object" && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  } finally {
    reader.releaseLock();
  }
}
