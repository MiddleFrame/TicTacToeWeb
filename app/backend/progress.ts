import { applyProgressionAction } from "./progression-actions";
import { and, count, eq, gt, sql } from "drizzle-orm";
import { getDb, getRawDb } from "../../db";
import { readElementProgress } from "./element-progress";
import { purchaseCollectionPack } from "./collection-store";
import {
  inventory,
  playerProgress,
  profiles,
  rewardLedger,
  wallets,
} from "../../db/schema";
import {
  STARTER_SELECTED_KINDS,
} from "../game/cards";
import {
  normalizeNickname,
  normalizeSelectedKinds,
  normalizeUnlockedKinds,
  parseStoredKinds,
  type PlayerProgressSnapshot,
} from "../game/player-progress";

const AD_REWARD = 50;
const AD_REWARD_LIMIT_PER_HOUR = 20;

async function ensureProgressRows(userId: string, now: Date): Promise<void> {
  const db = getDb();
  await db.batch([
    db.insert(playerProgress).values({
      userId,
      selectedKinds: JSON.stringify(STARTER_SELECTED_KINDS),
      createdAt: now,
      updatedAt: now,
    }).onConflictDoNothing(),
    ...STARTER_SELECTED_KINDS.map((itemId) => db.insert(inventory).values({
      userId,
      itemId,
      quantity: 1,
      acquiredAt: now,
    }).onConflictDoNothing()),
  ]);
}

export async function getPlayerProgress(
  userId: string,
  now = new Date(),
): Promise<PlayerProgressSnapshot> {
  const db = getDb();
  await ensureProgressRows(userId, now);
  const [account, items] = await Promise.all([
    db.select({
      publicCode: profiles.publicCode,
      nickname: profiles.nickname,
      coins: wallets.coins,
      cosmeticCurrency: wallets.cosmeticCurrency,
      selectedKinds: playerProgress.selectedKinds,
      legacyImportedAt: playerProgress.legacyImportedAt,
    })
      .from(profiles)
      .innerJoin(wallets, eq(wallets.userId, profiles.userId))
      .innerJoin(playerProgress, eq(playerProgress.userId, profiles.userId))
      .where(eq(profiles.userId, userId))
      .get(),
    db.select({ itemId: inventory.itemId })
      .from(inventory)
      .where(eq(inventory.userId, userId))
      .all(),
  ]);
  if (!account) throw new Error("Account progress is unavailable");
  const unlockedKinds = normalizeUnlockedKinds(items.map((item) => item.itemId));
  const { state } = await readElementProgress(getRawDb(), userId);
  return {
    ...state,
    accountId: userId,
    publicCode: account.publicCode,
    nickname: account.nickname,
    coins: account.coins,
    cosmeticCurrency: account.cosmeticCurrency,
    selectedKinds: normalizeSelectedKinds(
      parseStoredKinds(account.selectedKinds),
      unlockedKinds,
    ),
    unlockedKinds,
    legacyImported: account.legacyImportedAt !== null,
  };
}

export async function updatePlayerProfile(
  userId: string,
  input: { nickname?: unknown; selectedKinds?: unknown },
  now = new Date(),
): Promise<PlayerProgressSnapshot> {
  const db = getDb();
  const current = await getPlayerProgress(userId, now);
  const nickname = input.nickname === undefined
    ? current.nickname
    : normalizeNickname(input.nickname, current.nickname);
  const selectedKinds = input.selectedKinds === undefined
    ? current.selectedKinds
    : normalizeSelectedKinds(input.selectedKinds, current.unlockedKinds);
  await db.update(profiles).set({ nickname, updatedAt: now }).where(eq(profiles.userId, userId));
  if (input.selectedKinds !== undefined) {
    const library = current.deckLibrary;
    await applyProgressionAction(getRawDb(), userId, crypto.randomUUID(), {
      type: "save-decks",
      library: { ...library, decks: library.decks.map((deck) => deck.id === library.activeId ? { ...deck, kinds: selectedKinds } : deck) },
    });
  }
  return getPlayerProgress(userId, now);
}

export async function purchaseCardPack(
  userId: string,
  operationId: string,
  countValue: number,
  collectionId: string,
) {
  await getPlayerProgress(userId);
  const result = await purchaseCollectionPack(getRawDb(), userId, operationId, countValue, collectionId);
  return { ...result, progress: await getPlayerProgress(userId) };
}

export async function grantRewardedAdCoins(
  userId: string,
  operationId: string,
  now = new Date(),
): Promise<PlayerProgressSnapshot> {
  const db = getDb();
  const previous = await db.select({ id: rewardLedger.id })
    .from(rewardLedger)
    .where(and(
      eq(rewardLedger.operationId, operationId),
      eq(rewardLedger.userId, userId),
    ))
    .get();
  if (previous) return getPlayerProgress(userId, now);
  const [{ value: recentRewards }] = await db.select({ value: count() })
    .from(rewardLedger)
    .where(and(
      eq(rewardLedger.userId, userId),
      eq(rewardLedger.reason, "rewarded-ad"),
      gt(rewardLedger.createdAt, new Date(now.getTime() - 60 * 60 * 1000)),
    ));
  if (recentRewards >= AD_REWARD_LIMIT_PER_HOUR) throw new Error("reward-rate-limited");
  const current = await getPlayerProgress(userId, now);
  const balanceAfter = current.coins + AD_REWARD;
  await db.batch([
    db.update(wallets).set({
      coins: sql`${wallets.coins} + ${AD_REWARD}`,
      updatedAt: now,
    }).where(eq(wallets.userId, userId)),
    db.insert(rewardLedger).values({
      id: crypto.randomUUID(),
      operationId,
      userId,
      currency: "coins",
      amount: AD_REWARD,
      balanceAfter,
      reason: "rewarded-ad",
      createdAt: now,
    }),
  ]);
  return getPlayerProgress(userId, now);
}
