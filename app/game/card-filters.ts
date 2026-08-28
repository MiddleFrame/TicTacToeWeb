import { mechanicsForCard } from "./card-mechanics.ts";
import { DECK_BUILDING_KINDS, type CardKind } from "./cards.ts";

export type DeckCardFilter = "all" | "ice" | "regular";

export function deckFilterForCard(kind: CardKind): DeckCardFilter {
  return mechanicsForCard(kind).includes("ice") ? "ice" : "regular";
}

export function deckKindsForFilter(filter: DeckCardFilter): CardKind[] {
  if (filter === "all") return [...DECK_BUILDING_KINDS];
  return DECK_BUILDING_KINDS.filter((kind) => deckFilterForCard(kind) === filter);
}
