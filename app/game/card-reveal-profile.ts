import type { CardKind } from "./cards.ts";
import { mechanicsForCard, type CardMechanic } from "./card-mechanics.ts";

export type CardRevealRarity = "common" | "uncommon" | "rare" | "legendary";
export type CardRevealAccent = "neutral" | "ice" | "mana" | "creation" | "destruction";
export type CardRevealSound = "dock" | "light";

export type CardRevealCue = {
  atMs: number;
  sound: CardRevealSound;
  strength: number;
};

export type CardRevealProfile = {
  rarity: CardRevealRarity;
  accent: CardRevealAccent;
  accentRgb: string;
  durationMs: number;
  playbackRate: number;
  scale: number;
  glowAlpha: number;
  rootFrequency: number;
  cues: readonly CardRevealCue[];
};

const CARD_RARITIES: Readonly<Record<CardKind, CardRevealRarity>> = {
  place: "common",
  "place-draw": "common",
  "random-effect": "uncommon",
  "freeze-3": "uncommon",
  "place-5": "rare",
  "destroy-freeze": "rare",
  "freeze-effect": "uncommon",
  "freeze-6-figures": "rare",
  "freeze-all-mana": "legendary",
  "freeze-cell": "common",
  "full-house": "rare",
  "ice-encirclement": "rare",
  "place-around-freeze": "rare",
  "place-more": "legendary",
  shortage: "uncommon",
  "surrounded-by-ice": "legendary",
};

const ACCENT_BY_MECHANIC: Readonly<Partial<Record<CardMechanic, CardRevealAccent>>> = {
  destruction: "destruction",
  ice: "ice",
  mana: "mana",
  placement: "creation",
};

const ACCENT_PRIORITY: readonly CardMechanic[] = ["destruction", "ice", "mana", "placement"];

const ACCENT_SETTINGS: Readonly<Record<CardRevealAccent, { rgb: string; rootFrequency: number }>> = {
  neutral: { rgb: "245 197 76", rootFrequency: 220 },
  ice: { rgb: "110 211 255", rootFrequency: 293.66 },
  mana: { rgb: "199 131 255", rootFrequency: 261.63 },
  creation: { rgb: "255 204 89", rootFrequency: 246.94 },
  destruction: { rgb: "255 126 92", rootFrequency: 196 },
};

const RARITY_SETTINGS: Readonly<Record<CardRevealRarity, Pick<CardRevealProfile, "playbackRate" | "scale" | "glowAlpha"> & { soundStrength: number }>> = {
  common: { playbackRate: 1.08, scale: 0.97, glowAlpha: 0.22, soundStrength: 0.86 },
  uncommon: { playbackRate: 1.02, scale: 1, glowAlpha: 0.3, soundStrength: 0.96 },
  rare: { playbackRate: 0.96, scale: 1.04, glowAlpha: 0.4, soundStrength: 1.08 },
  legendary: { playbackRate: 0.9, scale: 1.08, glowAlpha: 0.5, soundStrength: 1.2 },
};

const BASE_CUES: readonly Omit<CardRevealCue, "strength">[] = [
  { atMs: 930, sound: "dock" },
  { atMs: 2420, sound: "dock" },
  { atMs: 3000, sound: "dock" },
  { atMs: 3480, sound: "dock" },
  { atMs: 3930, sound: "dock" },
  { atMs: 4420, sound: "dock" },
  { atMs: 4770, sound: "light" },
];

function accentForCard(kind: CardKind): CardRevealAccent {
  const mechanics = mechanicsForCard(kind);
  return ACCENT_PRIORITY.map((mechanic) => mechanics.includes(mechanic) ? ACCENT_BY_MECHANIC[mechanic] : undefined)
    .find((accent): accent is CardRevealAccent => Boolean(accent)) ?? "neutral";
}

export function cardRevealProfile(kind: CardKind): CardRevealProfile {
  const rarity = CARD_RARITIES[kind];
  const accent = accentForCard(kind);
  const raritySettings = RARITY_SETTINGS[rarity];
  const accentSettings = ACCENT_SETTINGS[accent];
  return {
    rarity,
    accent,
    accentRgb: accentSettings.rgb,
    durationMs: 6200,
    playbackRate: raritySettings.playbackRate,
    scale: raritySettings.scale,
    glowAlpha: raritySettings.glowAlpha,
    rootFrequency: accentSettings.rootFrequency,
    cues: BASE_CUES.map((cue, index) => ({
      ...cue,
      strength: raritySettings.soundStrength * (index === BASE_CUES.length - 1 ? 1.08 : 1),
    })),
  };
}
