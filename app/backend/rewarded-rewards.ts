import type { D1Database } from "@cloudflare/workers-types";

const AD_REWARD = 50;
const AD_REWARD_LIMIT_PER_HOUR = 20;
const REWARD_WINDOW_MS = 60 * 60 * 1000;

export class RewardedAdRateLimitError extends Error {
  readonly retryAfter: number;

  constructor(retryAfter: number) {
    super("reward-rate-limited");
    this.retryAfter = retryAfter;
  }
}

async function rewardRateLimit(db: D1Database, userId: string, now: number): Promise<RewardedAdRateLimitError> {
  const latestWindow = await db.prepare("SELECT created_at FROM reward_ledger WHERE user_id = ? AND reason = 'rewarded-ad' AND created_at > ? ORDER BY created_at DESC LIMIT 1 OFFSET ?")
    .bind(userId, now - REWARD_WINDOW_MS, AD_REWARD_LIMIT_PER_HOUR - 1).first<{ created_at: number }>();
  const retryAfter = latestWindow ? Math.max(1, Math.ceil((latestWindow.created_at + REWARD_WINDOW_MS - now) / 1000)) : 1;
  return new RewardedAdRateLimitError(retryAfter);
}

export async function grantRewardedAd(db: D1Database, userId: string, operationId: string, now = Date.now()): Promise<void> {
  const ledgerId = crypto.randomUUID();
  const results = await db.batch<{ id: string; user_id: string }>([
    db.prepare(`INSERT INTO reward_ledger (id, operation_id, user_id, currency, amount, balance_after, reason, created_at)
      SELECT ?, ?, user_id, 'coins', ?, coins + ?, 'rewarded-ad', ? FROM wallets
      WHERE user_id = ? AND (SELECT count(*) FROM reward_ledger WHERE user_id = ? AND reason = 'rewarded-ad' AND created_at > ?) < ?
      ON CONFLICT (operation_id) DO NOTHING`)
      .bind(ledgerId, operationId, AD_REWARD, AD_REWARD, now, userId, userId, now - REWARD_WINDOW_MS, AD_REWARD_LIMIT_PER_HOUR),
    db.prepare("UPDATE wallets SET coins = coins + ?, updated_at = ? WHERE user_id = ? AND EXISTS (SELECT 1 FROM reward_ledger WHERE id = ? AND user_id = ?)")
      .bind(AD_REWARD, now, userId, ledgerId, userId),
    db.prepare("SELECT id, user_id FROM reward_ledger WHERE operation_id = ?").bind(operationId),
  ]);
  const receipt = results[2].results[0];
  if (receipt?.user_id === userId) return;
  if (receipt) throw new Error("invalid-reward");
  const wallet = await db.prepare("SELECT user_id FROM wallets WHERE user_id = ?").bind(userId).first();
  if (!wallet) throw new Error("progress-unavailable");
  throw await rewardRateLimit(db, userId, now);
}
