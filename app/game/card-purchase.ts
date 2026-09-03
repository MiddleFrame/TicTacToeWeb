import type { CardKind } from "./cards.ts";
import { CARD_COLLECTION, collectionCards } from "./collections.ts";
import { DUPLICATE_XP } from "./element-progression.ts";

export type CardDrop = { kind: CardKind; duplicate: boolean; collectionId: string; xp: number; xpBefore?: number; xpAfter?: number };

export function drawCollectionPack(collectionId: string, count: number, owned: readonly CardKind[], random = Math.random): CardDrop[] {
  if (!STORE_PACK_SIZES.some((size) => size === count)) throw new Error("invalid-pack-size");
  const pool = collectionCards(collectionId);
  const known = new Set(owned);
  return Array.from({ length: count }, () => {
    const kind = pool[Math.max(0, Math.min(pool.length - 1, Math.floor(random() * pool.length)))];
    const duplicate = known.has(kind);
    known.add(kind);
    return { kind, duplicate, collectionId: CARD_COLLECTION[kind], xp: Number(duplicate) * DUPLICATE_XP };
  });
}

export const CARD_PRICE = 50;
export const STORE_PACK_SIZES = [1, 5] as const;

export function cardPackCost(count: number): number {
  const normalized = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
  return normalized * CARD_PRICE;
}
