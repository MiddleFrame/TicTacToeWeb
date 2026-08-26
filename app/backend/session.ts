const SESSION_COOKIE = "tttp_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 30;
const PUBLIC_CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}

function randomBytes(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length));
}

export function createSessionToken(): string {
  return bytesToHex(randomBytes(32));
}

export async function hashSessionToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token),
  );
  return bytesToHex(new Uint8Array(digest));
}

export function createPublicCode(): string {
  const values = randomBytes(10);
  return Array.from(
    values,
    (value) => PUBLIC_CODE_ALPHABET[value % PUBLIC_CODE_ALPHABET.length],
  ).join("");
}

export function readSessionToken(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  const prefix = `${SESSION_COOKIE}=`;
  const match = cookieHeader
    .split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith(prefix));
  if (!match) return null;
  const token = match.slice(prefix.length);
  return /^[a-f0-9]{64}$/.test(token) ? token : null;
}

export function createSessionCookie(token: string, secure: boolean): string {
  const parts = [
    `${SESSION_COOKIE}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${SESSION_DURATION_SECONDS}`,
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export function clearSessionCookie(secure: boolean): string {
  const parts = [
    `${SESSION_COOKIE}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export function sessionExpiresAt(now: Date): Date {
  return new Date(now.getTime() + SESSION_DURATION_SECONDS * 1000);
}

export function isSecureRequest(request: Request): boolean {
  return new URL(request.url).protocol === "https:";
}
