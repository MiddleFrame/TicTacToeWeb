import {
  DECK_BUILDING_KINDS,
  STARTER_SELECTED_KINDS,
  type CardKind,
} from "./cards.ts";

export const MAX_LEGACY_COINS = 1_000_000;
export const STARTER_COINS = 220;
export const MAX_PLAYER_NAME_LENGTH = 20;
export const MIN_SELECTED_KINDS = 5;
export const MAX_SELECTED_KINDS = 16;

export type PlayerProgressSnapshot = {
  accountId: string;
  publicCode: string;
  nickname: string;
  coins: number;
  cosmeticCurrency: number;
  selectedKinds: CardKind[];
  unlockedKinds: CardKind[];
  legacyImported: boolean;
};

export type LocalProgressSnapshot = {
  nickname: string;
  coins: number;
  selectedKinds: CardKind[];
  unlockedKinds: CardKind[];
};

export function validCardKinds(value: unknown): CardKind[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter(
    (kind): kind is CardKind =>
      typeof kind === "string" && DECK_BUILDING_KINDS.includes(kind as CardKind),
  ))];
}

export function normalizeNickname(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const normalized = value.trim().replace(/\s+/g, " ").slice(0, MAX_PLAYER_NAME_LENGTH);
  return normalized || fallback;
}

export function normalizeCoins(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.min(MAX_LEGACY_COINS, Math.max(0, Math.floor(value)));
}

export function normalizeUnlockedKinds(value: unknown): CardKind[] {
  return [...new Set([...STARTER_SELECTED_KINDS, ...validCardKinds(value)])];
}

export function normalizeSelectedKinds(
  value: unknown,
  unlockedKinds: readonly CardKind[],
): CardKind[] {
  const selected = validCardKinds(value).filter((kind) => unlockedKinds.includes(kind));
  return selected.length >= MIN_SELECTED_KINDS && selected.length <= MAX_SELECTED_KINDS
    ? selected
    : [...STARTER_SELECTED_KINDS];
}

export function parseStoredKinds(value: string | null): CardKind[] {
  if (!value) return [];
  try {
    return validCardKinds(JSON.parse(value));
  } catch {
    return [];
  }
}

export function isOperationId(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9-]{20,64}$/i.test(value);
}
