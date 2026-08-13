import type { CardKind } from "./cards.ts";

export const CARD_PRICE = 50;
export const STORE_PACK_SIZES = [1, 5] as const;

export function cardPackCost(count: number): number {
  const normalized = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
  return normalized * CARD_PRICE;
}

export function drawCardPack(
  lockedKinds: readonly CardKind[],
  requestedCount: number,
  random: () => number = Math.random,
): CardKind[] {
  const available = [...lockedKinds];
  const normalized = Number.isFinite(requestedCount) ? Math.max(0, Math.floor(requestedCount)) : 0;
  const count = Math.min(available.length, normalized);
  return Array.from({ length: count }, () => {
    const index = Math.min(available.length - 1, Math.floor(random() * available.length));
    return available.splice(index, 1)[0];
  });
}
