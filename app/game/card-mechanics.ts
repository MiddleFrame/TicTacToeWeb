import type { CardKind } from "./cards.ts";

export type CardMechanic =
  | "area"
  | "delayed"
  | "destruction"
  | "draw"
  | "ice"
  | "mana"
  | "placement"
  | "random";

export const CARD_MECHANICS: Readonly<Record<CardKind, readonly CardMechanic[]>> = {
  place: ["placement"],
  "place-draw": ["placement", "draw"],
  "random-effect": ["placement", "random", "delayed"],
  "freeze-3": ["ice", "random"],
  "place-5": ["placement", "random"],
  "destroy-freeze": ["ice", "destruction", "placement"],
  "freeze-effect": ["ice", "random", "delayed"],
  "freeze-6-figures": ["ice"],
  "freeze-all-mana": ["ice", "mana"],
  "freeze-cell": ["ice"],
  "full-house": ["draw"],
  "ice-encirclement": ["ice", "area"],
  "place-around-freeze": ["ice", "area", "random"],
  "place-more": ["placement", "mana", "random"],
  shortage: ["draw"],
  "surrounded-by-ice": ["ice", "destruction", "area"],
};

export function mechanicsForCard(kind: CardKind): readonly CardMechanic[] {
  return CARD_MECHANICS[kind];
}
