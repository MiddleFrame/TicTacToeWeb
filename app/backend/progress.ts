import { and, count, eq, gt, sql } from "drizzle-orm";
import { getDb } from "../../db";
import {
  inventory,
  playerProgress,
  profiles,
  rewardLedger,
  storePurchases,
  wallets,
} from "../../db/schema";
import { cardPackCost } from "../game/card-purchase";
import {
  DECK_BUILDING_KINDS,
  STARTER_SELECTED_KINDS,
  type CardKind,
} from "../game/cards";
import {
  normalizeCoins,
  normalizeNickname,
  normalizeSelectedKinds,
  normalizeUnlockedKinds,
  parseStoredKinds,
  type LocalProgressSnapshot,
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
  return {
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

export async function importLegacyProgress(
  userId: string,
  input: LocalProgressSnapshot,
  now = new Date(),
): Promise<PlayerProgressSnapshot> {
  const db = getDb();
  const current = await getPlayerProgress(userId, now);
  if (current.legacyImported) return current;
  const unlockedKinds = normalizeUnlockedKinds([
    ...current.unlockedKinds,
    ...normalizeUnlockedKinds(input.unlockedKinds),
  ]);
  const selectedKinds = normalizeSelectedKinds(input.selectedKinds, unlockedKinds);
  const importedCoins = Math.max(current.coins, normalizeCoins(input.coins));
  const nicknameCandidate = normalizeNickname(input.nickname, current.nickname);
  const nickname = nicknameCandidate === "Игрок" ? current.nickname : nicknameCandidate;
  const statements: Parameters<typeof db.batch>[0][number][] = [
    db.update(profiles).set({ nickname, updatedAt: now }).where(eq(profiles.userId, userId)),
    db.update(wallets).set({ coins: importedCoins, updatedAt: now }).where(eq(wallets.userId, userId)),
    db.update(playerProgress).set({
      selectedKinds: JSON.stringify(selectedKinds),
      legacyImportedAt: now,
      updatedAt: now,
    }).where(eq(playerProgress.userId, userId)),
    ...unlockedKinds.map((itemId) => db.insert(inventory).values({
      userId,
      itemId,
      quantity: 1,
      acquiredAt: now,
    }).onConflictDoNothing()),
  ];
  if (importedCoins > current.coins) {
    statements.push(db.insert(rewardLedger).values({
      id: crypto.randomUUID(),
      operationId: `legacy-${userId}`,
      userId,
      currency: "coins",
      amount: importedCoins - current.coins,
      balanceAfter: importedCoins,
      reason: "legacy-import",
      createdAt: now,
    }).onConflictDoNothing());
  }
  const [firstStatement, ...remainingStatements] = statements;
  await db.batch([firstStatement, ...remainingStatements]);
  return getPlayerProgress(userId, now);
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
  await db.batch([
    db.update(profiles).set({ nickname, updatedAt: now }).where(eq(profiles.userId, userId)),
    db.update(playerProgress).set({
      selectedKinds: JSON.stringify(selectedKinds),
      updatedAt: now,
    }).where(eq(playerProgress.userId, userId)),
  ]);
  return getPlayerProgress(userId, now);
}

function drawServerCards(lockedKinds: readonly CardKind[], countValue: number): CardKind[] {
  const available = [...lockedKinds];
  return Array.from({ length: countValue }, () => {
    const values = crypto.getRandomValues(new Uint32Array(1));
    const index = values[0] % available.length;
    return available.splice(index, 1)[0];
  });
}

export async function purchaseCardPack(
  userId: string,
  operationId: string,
  countValue: number,
  now = new Date(),
): Promise<{ progress: PlayerProgressSnapshot; purchasedKinds: CardKind[] }> {
  const db = getDb();
  const previous = await db.select({ purchasedKinds: storePurchases.purchasedKinds })
    .from(storePurchases)
    .where(and(
      eq(storePurchases.operationId, operationId),
      eq(storePurchases.userId, userId),
    ))
    .get();
  if (previous) {
    return {
      progress: await getPlayerProgress(userId, now),
      purchasedKinds: parseStoredKinds(previous.purchasedKinds),
    };
  }
  if (countValue !== 1 && countValue !== 5) throw new Error("invalid-pack-size");
  const current = await getPlayerProgress(userId, now);
  const lockedKinds = DECK_BUILDING_KINDS.filter(
    (kind) => !current.unlockedKinds.includes(kind),
  );
  const cost = cardPackCost(countValue);
  if (current.coins < cost) throw new Error("insufficient-coins");
  if (lockedKinds.length < countValue) throw new Error("insufficient-locked-cards");
  const purchasedKinds = drawServerCards(lockedKinds, countValue);
  const selectedKinds = [...new Set([...current.selectedKinds, ...purchasedKinds])];
  const balanceAfter = current.coins - cost;
  await db.batch([
    db.update(wallets).set({
      coins: sql`${wallets.coins} - ${cost}`,
      updatedAt: now,
    }).where(and(eq(wallets.userId, userId), sql`${wallets.coins} >= ${cost}`)),
    ...purchasedKinds.map((itemId) => db.insert(inventory).values({
      userId,
      itemId,
      quantity: 1,
      acquiredAt: now,
    }).onConflictDoNothing()),
    db.update(playerProgress).set({
      selectedKinds: JSON.stringify(selectedKinds),
      updatedAt: now,
    }).where(eq(playerProgress.userId, userId)),
    db.insert(rewardLedger).values({
      id: crypto.randomUUID(),
      operationId,
      userId,
      currency: "coins",
      amount: -cost,
      balanceAfter,
      reason: "card-pack",
      createdAt: now,
    }),
    db.insert(storePurchases).values({
      operationId,
      userId,
      purchasedKinds: JSON.stringify(purchasedKinds),
      cost,
      createdAt: now,
    }),
  ]);
  return { progress: await getPlayerProgress(userId, now), purchasedKinds };
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
