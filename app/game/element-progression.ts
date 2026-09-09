import { CARD_COLLECTION, COLLECTIONS } from "./collections.ts";
import type { CardKind } from "./cards.ts";
import { LEGACY_XP_PER_LEVEL, PASS_LEVELS, PROGRESSION_VERSION, levelThreshold, migrateLegacyXp, progressionVersion, type ProgressionVersion } from "./progression-curve.ts";

export { PASS_LEVELS, PROGRESSION_VERSION, levelCost, levelProgress, levelThreshold, passLevel } from "./progression-curve.ts";

export const DUPLICATE_XP = 30;
export const LEGACY_DUPLICATE_XP = 100;
export const ROUND_XP = { win: 3, loss: 1, draw: 0 } as const;
export type RoundOutcome = keyof typeof ROUND_XP;
export type RewardTrack = "free" | "premium";
export type PassReward = { type: "currency"; currency: "coins"; amount: number };
export type PassLevel = { level: number; rewards: Record<RewardTrack, PassReward[]> };
export type ElementPass = { xp: number; premium: boolean; claimed: string[]; version?: ProgressionVersion; legacyXp?: number };
export type ElementPasses = Record<string, ElementPass>;
export type XpAward = { collectionId: string; amount: number; before: number; after: number };

export const PASS_REWARDS: readonly PassLevel[] = Array.from({ length: PASS_LEVELS }, (_, index) => ({
  level: index + 1,
  rewards: {
    free: [],
    premium: [],
  },
}));

export function emptyPass(): ElementPass {
  return { xp: 0, premium: false, claimed: [], version: PROGRESSION_VERSION };
}

export const PREMIUM_MILESTONES = {
  40: "cardOpening",
  60: "cardAppearance",
  80: "placementAnimation",
  100: "boardAnimation",
} as const;

function boundedXp(value: unknown, maximum: number): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(maximum, Math.floor(value))) : 0;
}

export function normalizePass(value: unknown, collectionId: string): ElementPass {
  if (!value || typeof value !== "object") return emptyPass();
  const source = value as Record<string, unknown>;
  const legacy = progressionVersion(source.version) === 1;
  const legacyXp = boundedXp(legacy ? source.xp : source.legacyXp, PASS_LEVELS * LEGACY_XP_PER_LEVEL);
  return {
    xp: legacy ? migrateLegacyXp(legacyXp, collectionId) : boundedXp(source.xp, levelThreshold(collectionId, PASS_LEVELS)),
    premium: source.premium === true,
    claimed: Array.isArray(source.claimed) ? [...new Set(source.claimed.filter((key): key is string => typeof key === "string" && /^\d{1,3}:(free|premium)$/.test(key)))] : [],
    version: PROGRESSION_VERSION,
    ...(legacy || source.legacyXp !== undefined ? { legacyXp } : {}),
  };
}

export function normalizePasses(value: unknown): ElementPasses {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return Object.fromEntries(COLLECTIONS.map(({ id }) => [id, normalizePass(source[id], id)]));
}

export function initialPasses(): ElementPasses {
  return Object.fromEntries(COLLECTIONS.map(({ id }) => [id, emptyPass()]));
}

export function claimKey(level: number, track: RewardTrack): string {
  return `${level}:${track}`;
}

const trackAccess: Record<RewardTrack, (pass: ElementPass) => boolean> = {
  free: () => true,
  premium: (pass) => pass.premium,
};

export function canClaim(pass: ElementPass, level: number, track: RewardTrack): boolean {
  return rewardsFor(pass, level, track).length > 0
    && Boolean(trackAccess[track]?.(pass)) && !pass.claimed.includes(claimKey(level, track));
}

export function rewardsFor(pass: ElementPass, level: number, track: RewardTrack): PassReward[] {
  if (!Number.isInteger(level) || level < 1 || level > PASS_LEVELS || !Object.hasOwn(trackAccess, track)) return [];
  const legacyXp = pass.version === PROGRESSION_VERSION ? pass.legacyXp ?? 0 : pass.xp;
  if (level > Math.floor(legacyXp / LEGACY_XP_PER_LEVEL)) return PASS_REWARDS[level - 1].rewards[track];
  return [{ type: "currency", currency: "coins", amount: track === "free" ? 10 : 25 }];
}

export function availableClaims(pass: ElementPass): { level: number; track: RewardTrack }[] {
  return PASS_REWARDS.flatMap(({ level }) => (["free", "premium"] as RewardTrack[])
    .filter((track) => canClaim(pass, level, track)).map((track) => ({ level, track })));
}

export function claimableRewards(pass: ElementPass): { keys: string[]; coins: number } {
  const claims = availableClaims(pass);
  return {
    keys: claims.map(({ level, track }) => claimKey(level, track)),
    coins: claims.reduce((total, { level, track }) => total + rewardsFor(pass, level, track)
      .reduce((rewardTotal, reward) => rewardTotal + (reward.currency === "coins" ? reward.amount : 0), 0), 0),
  };
}

export function awardExperience(passes: ElementPasses, amounts: Record<string, number>, version: ProgressionVersion = PROGRESSION_VERSION): XpAward[] {
  return Object.entries(amounts).filter(([, amount]) => amount > 0).map(([collectionId, amount]) => {
    const pass = normalizePass(passes[collectionId], collectionId);
    passes[collectionId] = pass;
    const before = pass.xp;
    let awarded = amount;
    if (version === 1) {
      const legacyBefore = pass.legacyXp ?? 0;
      pass.legacyXp = Math.min(PASS_LEVELS * LEGACY_XP_PER_LEVEL, legacyBefore + amount);
      awarded = migrateLegacyXp(pass.legacyXp, collectionId) - migrateLegacyXp(legacyBefore, collectionId);
    }
    pass.xp = Math.min(levelThreshold(collectionId, PASS_LEVELS), before + awarded);
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
