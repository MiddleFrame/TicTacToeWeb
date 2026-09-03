import { CARD_COLLECTION } from "./collections.ts";
import { DECK_BUILDING_KINDS, type CardKind } from "./cards.ts";

export type DeckCardFilter = string;

export function deckFilterForCard(kind: CardKind): DeckCardFilter {
  return CARD_COLLECTION[kind];
}

export function deckKindsForFilter(filter: DeckCardFilter): CardKind[] {
  if (filter === "all") return [...DECK_BUILDING_KINDS];
  return DECK_BUILDING_KINDS.filter((kind) => deckFilterForCard(kind) === filter);
}
