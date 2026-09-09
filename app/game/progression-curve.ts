import { collectionById } from "./collections.ts";

export const PROGRESSION_VERSION = 2;
export const PASS_LEVELS = 100;
export const LEGACY_XP_PER_LEVEL = 1000;
export type ProgressionVersion = 1 | 2;

export function progressionVersion(value: unknown): ProgressionVersion {
  if (value === undefined || value === 1) return 1;
  if (value === PROGRESSION_VERSION) return PROGRESSION_VERSION;
  throw new Error("unsupported-progression-version");
}

export function levelCost(collectionId: string, level: number): number {
  return collectionById(collectionId).neutral ? 550 + 45 * (level - 1) : 250 + 20 * (level - 1);
}

export function levelThreshold(collectionId: string, level: number): number {
  const bounded = Math.max(0, Math.min(PASS_LEVELS, Math.floor(level)));
  return collectionById(collectionId).neutral
    ? 550 * bounded + 45 * bounded * (bounded - 1) / 2
    : 250 * bounded + 10 * bounded * (bounded - 1);
}

export function passLevel(xp: number, collectionId: string): number {
  let level = 0;
  while (level < PASS_LEVELS && xp >= levelThreshold(collectionId, level + 1)) level++;
  return level;
}

export function levelProgress(xp: number, collectionId: string) {
  const total = Math.max(0, Math.min(levelThreshold(collectionId, PASS_LEVELS), Math.floor(xp)));
  const level = passLevel(total, collectionId);
  const current = total - levelThreshold(collectionId, level);
  const required = level === PASS_LEVELS ? 0 : levelCost(collectionId, level + 1);
  return { level, current, required, total, percent: required === 0 ? 100 : current / required * 100 };
}

export function migrateLegacyXp(xp: number, collectionId: string): number {
  const bounded = Math.max(0, Math.min(PASS_LEVELS * LEGACY_XP_PER_LEVEL, Math.floor(xp)));
  const level = Math.floor(bounded / LEGACY_XP_PER_LEVEL);
  const remainder = bounded % LEGACY_XP_PER_LEVEL;
  return levelThreshold(collectionId, level) + Math.floor(remainder * levelCost(collectionId, level + 1) / LEGACY_XP_PER_LEVEL);
}

export function legacyDisplayXp(xp: number, collectionId: string): number {
  const progress = levelProgress(xp, collectionId);
  return progress.level * LEGACY_XP_PER_LEVEL
    + (progress.required === 0 ? 0 : Math.floor(progress.current * LEGACY_XP_PER_LEVEL / progress.required));
}
