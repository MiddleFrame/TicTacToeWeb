import { and, eq, gt } from "drizzle-orm";
import { getDb } from "../../db";
import {
  identities,
  profiles,
  sessions,
  users,
  wallets,
} from "../../db/schema";
import {
  createPublicCode,
  createSessionToken,
  hashSessionToken,
  sessionExpiresAt,
} from "./session";

export type AccountSnapshot = {
  id: string;
  status: "active" | "banned" | "deleted";
  profile: {
    publicCode: string;
    nickname: string;
    avatarId: string | null;
    frameId: string | null;
    titleId: string | null;
  };
  wallet: {
    coins: number;
    cosmeticCurrency: number;
  };
};

export type CreatedGuestAccount = {
  account: AccountSnapshot;
  sessionToken: string;
  expiresAt: Date;
};

function toSnapshot(row: {
  id: string;
  status: "active" | "banned" | "deleted";
  publicCode: string;
  nickname: string;
  avatarId: string | null;
  frameId: string | null;
  titleId: string | null;
  coins: number;
  cosmeticCurrency: number;
}): AccountSnapshot {
  return {
    id: row.id,
    status: row.status,
    profile: {
      publicCode: row.publicCode,
      nickname: row.nickname,
      avatarId: row.avatarId,
      frameId: row.frameId,
      titleId: row.titleId,
    },
    wallet: {
      coins: row.coins,
      cosmeticCurrency: row.cosmeticCurrency,
    },
  };
}

export async function findAccountBySessionToken(
  sessionToken: string,
  now = new Date(),
): Promise<AccountSnapshot | null> {
  const db = getDb();
  const tokenHash = await hashSessionToken(sessionToken);
  const row = await db
    .select({
      id: users.id,
      status: users.status,
      publicCode: profiles.publicCode,
      nickname: profiles.nickname,
      avatarId: profiles.avatarId,
      frameId: profiles.frameId,
      titleId: profiles.titleId,
      coins: wallets.coins,
      cosmeticCurrency: wallets.cosmeticCurrency,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .innerJoin(profiles, eq(profiles.userId, users.id))
    .innerJoin(wallets, eq(wallets.userId, users.id))
    .where(
      and(
        eq(sessions.tokenHash, tokenHash),
        gt(sessions.expiresAt, now),
      ),
    )
    .get();
  return row ? toSnapshot(row) : null;
}

export async function createGuestAccount(
  now = new Date(),
): Promise<CreatedGuestAccount> {
  const db = getDb();
  const userId = crypto.randomUUID();
  const identityId = crypto.randomUUID();
  const sessionToken = createSessionToken();
  const tokenHash = await hashSessionToken(sessionToken);
  const expiresAt = sessionExpiresAt(now);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const publicCode = createPublicCode();
    const nickname = `Игрок ${publicCode.slice(-4)}`;
    try {
      await db.batch([
        db.insert(users).values({
          id: userId,
          status: "active",
          createdAt: now,
          updatedAt: now,
        }),
        db.insert(identities).values({
          id: identityId,
          userId,
          provider: "guest",
          providerUserId: userId,
          createdAt: now,
        }),
        db.insert(profiles).values({
          userId,
          publicCode,
          nickname,
          createdAt: now,
          updatedAt: now,
        }),
        db.insert(wallets).values({
          userId,
          coins: 0,
          cosmeticCurrency: 0,
          updatedAt: now,
        }),
        db.insert(sessions).values({
          tokenHash,
          userId,
          expiresAt,
          createdAt: now,
        }),
      ]);

      return {
        account: {
          id: userId,
          status: "active",
          profile: {
            publicCode,
            nickname,
            avatarId: null,
            frameId: null,
            titleId: null,
          },
          wallet: { coins: 0, cosmeticCurrency: 0 },
        },
        sessionToken,
        expiresAt,
      };
    } catch (error) {
      if (attempt === 2) throw error;
    }
  }

  throw new Error("Guest account could not be created");
}

export async function revokeSession(sessionToken: string): Promise<void> {
  const db = getDb();
  const tokenHash = await hashSessionToken(sessionToken);
  await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
}
