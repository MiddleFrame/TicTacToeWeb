import { CARD_COLLECTION, COLLECTIONS } from "./collections.ts";
import type { CardKind } from "./cards.ts";

export const PASS_LEVELS = 100;
export const XP_PER_LEVEL = 1000;
export const DUPLICATE_XP = 100;
export const ROUND_XP = { win: 3, loss: 1, draw: 0 } as const;
export type RoundOutcome = keyof typeof ROUND_XP;
export type RewardTrack = "free" | "premium";
export type PassReward = { type: "currency"; currency: "coins"; amount: number };
export type PassLevel = { level: number; rewards: Record<RewardTrack, PassReward[]> };
export type ElementPass = { xp: number; premium: boolean; claimed: string[] };
export type ElementPasses = Record<string, ElementPass>;
export type XpAward = { collectionId: string; amount: number; before: number; after: number };

export const PASS_REWARDS: readonly PassLevel[] = Array.from({ length: PASS_LEVELS }, (_, index) => ({
  level: index + 1,
  rewards: {
    free: [{ type: "currency", currency: "coins", amount: 10 }],
    premium: [{ type: "currency", currency: "coins", amount: 25 }],
  },
}));

export function emptyPass(): ElementPass {
  return { xp: 0, premium: false, claimed: [] };
}

export function initialPasses(): ElementPasses {
  return Object.fromEntries(COLLECTIONS.map(({ id }) => [id, emptyPass()]));
}

export function passLevel(xp: number): number {
  return Math.min(PASS_LEVELS, Math.floor(Math.max(0, xp) / XP_PER_LEVEL));
}

export function claimKey(level: number, track: RewardTrack): string {
  return `${level}:${track}`;
}

const trackAccess: Record<RewardTrack, (pass: ElementPass) => boolean> = {
  free: () => true,
  premium: (pass) => pass.premium,
};

export function canClaim(pass: ElementPass, level: number, track: RewardTrack): boolean {
  return Number.isInteger(level) && level >= 1 && level <= passLevel(pass.xp)
    && Boolean(trackAccess[track]?.(pass)) && !pass.claimed.includes(claimKey(level, track));
}

export function availableClaims(pass: ElementPass): { level: number; track: RewardTrack }[] {
  return PASS_REWARDS.flatMap(({ level }) => (["free", "premium"] as RewardTrack[])
    .filter((track) => canClaim(pass, level, track)).map((track) => ({ level, track })));
}

export function awardExperience(passes: ElementPasses, amounts: Record<string, number>): XpAward[] {
  return Object.entries(amounts).filter(([, amount]) => amount > 0).map(([collectionId, amount]) => {
    const pass = passes[collectionId];
    const before = pass.xp;
    pass.xp = Math.min(PASS_LEVELS * XP_PER_LEVEL, before + amount);
    return { collectionId, amount: pass.xp - before, before, after: pass.xp };
  });
}

export function roundExperience(cards: readonly CardKind[], outcome: RoundOutcome): Record<string, number> {
  return cards.reduce<Record<string, number>>((totals, kind) => {
    const id = CARD_COLLECTION[kind];
    totals[id] = (totals[id] ?? 0) + ROUND_XP[outcome];
    return totals;
  }, {});
}
