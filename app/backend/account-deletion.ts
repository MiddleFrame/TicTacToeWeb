import type { D1Database } from "@cloudflare/workers-types";
import { createSessionToken, hashSessionToken } from "./session.ts";

type DeletionDb = Pick<D1Database, "prepare" | "batch">;
export type DeletionAccount = { id: string; publicCode: string; nickname: string; googleSubject: string | null };
const TICKET_LIFETIME = 10 * 60_000;

export async function deletionAccount(db: DeletionDb, userId: string): Promise<DeletionAccount | null> {
  return db.prepare(`
    SELECT u.id, p.public_code AS publicCode, p.nickname, i.provider_user_id AS googleSubject
    FROM users u JOIN profiles p ON p.user_id = u.id
    LEFT JOIN identities i ON i.user_id = u.id AND i.provider = 'google'
    WHERE u.id = ?1 AND u.status IN ('active', 'banned')
  `).bind(userId).first<DeletionAccount>();
}

export async function deletionSessionAccount(db: DeletionDb, token: string, now = Date.now()): Promise<DeletionAccount | null> {
  const session = await db.prepare("SELECT user_id FROM sessions WHERE token_hash = ?1 AND expires_at > ?2")
    .bind(await hashSessionToken(token), now).first<{ user_id: string }>();
  return session ? deletionAccount(db, session.user_id) : null;
}

export async function deletionGoogleAccount(db: DeletionDb, subject: string): Promise<DeletionAccount | null> {
  const identity = await db.prepare("SELECT user_id FROM identities WHERE provider = 'google' AND provider_user_id = ?1")
    .bind(subject).first<{ user_id: string }>();
  return identity ? deletionAccount(db, identity.user_id) : null;
}

export async function issueDeletionTicket(db: DeletionDb, userId: string, now = Date.now()): Promise<string> {
  const ticket = createSessionToken();
  await db.batch([
    db.prepare("DELETE FROM account_deletion_tickets WHERE token_hash IN (SELECT token_hash FROM account_deletion_tickets WHERE expires_at <= ?1 ORDER BY expires_at LIMIT 128)").bind(now),
    db.prepare("DELETE FROM account_deletion_tickets WHERE user_id = ?1").bind(userId),
    db.prepare("INSERT INTO account_deletion_tickets (token_hash, user_id, expires_at) VALUES (?1, ?2, ?3)")
      .bind(await hashSessionToken(ticket), userId, now + TICKET_LIFETIME),
  ]);
  return ticket;
}

export function deletionInput(input: unknown): { ticket: string; publicCode: string } | null {
  if (!input || typeof input !== "object") return null;
  const value = input as Record<string, unknown>;
  if (value.confirm !== "DELETE" || typeof value.ticket !== "string" || !/^[a-f0-9]{64}$/.test(value.ticket)) return null;
  if (typeof value.publicCode !== "string" || !/^[23456789A-HJ-NP-Z]{10}$/.test(value.publicCode)) return null;
  return { ticket: value.ticket, publicCode: value.publicCode };
}

export async function deleteAccountWithTicket(db: DeletionDb, ticket: string, publicCode: string, now = Date.now()): Promise<string | null> {
  const tokenHash = await hashSessionToken(ticket);
  const target = `SELECT t.user_id FROM account_deletion_tickets t
    JOIN profiles p ON p.user_id = t.user_id
    WHERE t.token_hash = ?1 AND t.expires_at > ?2 AND p.public_code = ?3`;
  const result = await db.batch<{ id: string }>([
    db.prepare(`DELETE FROM admin_audit_log WHERE actor_user_id IN (${target}) OR target_user_id IN (${target})`).bind(tokenHash, now, publicCode),
    db.prepare(`DELETE FROM users WHERE id IN (${target}) RETURNING id`).bind(tokenHash, now, publicCode),
  ]);
  return (result[1].results[0]?.id as string | undefined) ?? null;
}
