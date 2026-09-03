import { STARTER_SELECTED_KINDS, type CardKind } from "./cards.ts";
import { compatibleDeck } from "./collections.ts";

export type SavedDeck = { id: string; name: string; kinds: CardKind[] };
export type DeckLibrary = { activeId: string; decks: SavedDeck[] };

export function initialDeckLibrary(kinds: readonly CardKind[] = STARTER_SELECTED_KINDS): DeckLibrary {
  return { activeId: "starter", decks: [{ id: "starter", name: "1", kinds: [...kinds] }] };
}

export function validateDeck(kinds: readonly CardKind[], unlocked: readonly CardKind[]): boolean {
  return kinds.length >= 5 && kinds.length <= 16 && new Set(kinds).size === kinds.length
    && kinds.every((kind) => unlocked.includes(kind)) && compatibleDeck(kinds);
}

export function validateLibrary(value: unknown, unlocked: readonly CardKind[]): value is DeckLibrary {
  if (!value || typeof value !== "object") return false;
  const library = value as DeckLibrary;
  return Array.isArray(library.decks) && library.decks.length > 0 && library.decks.length <= 100
    && library.decks.every((deck) => deck && typeof deck.id === "string" && deck.id.length <= 64
      && typeof deck.name === "string" && deck.name.trim().length > 0 && deck.name.length <= 30
      && Array.isArray(deck.kinds) && validateDeck(deck.kinds, unlocked))
    && new Set(library.decks.map((deck) => deck.id)).size === library.decks.length
    && library.decks.some((deck) => deck.id === library.activeId);
}
