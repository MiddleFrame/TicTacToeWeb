import type { D1Database } from "@cloudflare/workers-types";

export type AdminAccount = {
  id: string;
  status: string;
  nickname: string;
  publicCode: string;
  coins: number;
  cosmeticCurrency: number;
  createdAt: number;
};

export type AdminAccountDetail = {
  account: AdminAccount;
  inventory: { itemId: string; quantity: number; acquiredAt: number }[];
  ledger: { id: string; operationId: string; currency: string; amount: number; balanceAfter: number; reason: string; createdAt: number }[];
  audit: { id: string; actorUserId: string | null; action: string; createdAt: number }[];
  moreInventory: boolean;
  moreLedger: boolean;
};

const ACCOUNT_SELECT = `
  SELECT u.id, u.status, p.nickname, p.public_code AS publicCode,
    w.coins, w.cosmetic_currency AS cosmeticCurrency, u.created_at AS createdAt
  FROM users u JOIN profiles p ON p.user_id = u.id JOIN wallets w ON w.user_id = u.id
`;

export async function searchAdminAccounts(db: D1Database, query: string) {
  const result = await db.prepare(`${ACCOUNT_SELECT}
    WHERE p.user_id = ?1 OR p.public_code = ?2 OR p.nickname = ?1 LIMIT 21
  `).bind(query, query.toUpperCase()).all<AdminAccount>();
  return { accounts: result.results.slice(0, 20), hasMore: result.results.length > 20 };
}

export async function readAdminAccount(
  db: D1Database,
  actorUserId: string,
  targetUserId: string,
  now = Date.now(),
): Promise<AdminAccountDetail | null> {
  const results = await db.batch([
    db.prepare(`
      INSERT INTO admin_audit_log (id, actor_user_id, target_user_id, action, created_at)
      SELECT ?1, ?2, id, 'account-view', ?4 FROM users WHERE id = ?3
    `).bind(crypto.randomUUID(), actorUserId, targetUserId, now),
    db.prepare(`${ACCOUNT_SELECT} WHERE u.id = ?1`).bind(targetUserId),
    db.prepare(`
      SELECT item_id AS itemId, quantity, acquired_at AS acquiredAt
      FROM inventory WHERE user_id = ?1 ORDER BY item_id LIMIT 201
    `).bind(targetUserId),
    db.prepare(`
      SELECT id, operation_id AS operationId, currency, amount, balance_after AS balanceAfter, reason, created_at AS createdAt
      FROM reward_ledger WHERE user_id = ?1 ORDER BY created_at DESC LIMIT 51
    `).bind(targetUserId),
    db.prepare(`
      SELECT id, actor_user_id AS actorUserId, action, created_at AS createdAt
      FROM admin_audit_log WHERE target_user_id = ?1 ORDER BY created_at DESC LIMIT 20
    `).bind(targetUserId),
  ]);
  const account = results[1].results[0] as AdminAccount | undefined;
  if (!account) return null;
  return {
    account,
    inventory: results[2].results.slice(0, 200) as AdminAccountDetail["inventory"],
    ledger: results[3].results.slice(0, 50) as AdminAccountDetail["ledger"],
    audit: results[4].results as AdminAccountDetail["audit"],
    moreInventory: results[2].results.length > 200,
    moreLedger: results[3].results.length > 50,
  };
}
