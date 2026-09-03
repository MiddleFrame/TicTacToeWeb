export function isAdminEmail(email: string | null | undefined, configured: string | undefined): boolean {
  if (!email || !configured) return false;
  const normalized = email.trim().toLowerCase();
  if (!/^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/.test(normalized)) return false;
  return configured.split(",").some((entry) => entry.trim().toLowerCase() === normalized);
}

export function adminSearchQuery(input: string | null): string | null {
  const query = input?.trim();
  return query && query.length >= 2 && query.length <= 64 ? query : null;
}
