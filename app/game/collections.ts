import { DECK_BUILDING_KINDS, type CardKind } from "./cards.ts";

export type CollectionDefinition = {
  id: string;
  name: { ru: string; en: string };
  neutral: boolean;
  color: string;
  image: string;
};

export const COLLECTIONS: readonly CollectionDefinition[] = [
  { id: "regular", name: { ru: "Основная коллекция", en: "Core collection" }, neutral: true, color: "#bc792c", image: "/game/cards/place-5-x.png" },
  { id: "ice", name: { ru: "Ледяная коллекция", en: "Ice collection" }, neutral: false, color: "#268cae", image: "/game/cards/freeze-3.png" },
];

export const CARD_COLLECTION: Readonly<Record<CardKind, string>> = {
  place: "regular", "place-draw": "regular", "random-effect": "regular",
  "place-5": "regular", "full-house": "regular", "place-more": "regular", shortage: "regular",
  "freeze-3": "ice", "destroy-freeze": "ice", "freeze-effect": "ice",
  "freeze-6-figures": "ice", "freeze-all-mana": "ice", "freeze-cell": "ice",
  "ice-encirclement": "ice", "place-around-freeze": "ice", "surrounded-by-ice": "ice",
};

export function collectionById(id: string): CollectionDefinition {
  const collection = COLLECTIONS.find((item) => item.id === id);
  if (!collection) throw new Error("unknown-collection");
  return collection;
}

export function collectionCards(id: string): CardKind[] {
  collectionById(id);
  return DECK_BUILDING_KINDS.filter((kind) => CARD_COLLECTION[kind] === id);
}

export type DeckPolicy = { maxElements: number; allowedCombinations: readonly (readonly string[])[] };
export const STANDARD_DECK_POLICY: DeckPolicy = { maxElements: 1, allowedCombinations: [] };

export function compatibleElements(elements: readonly string[], policy = STANDARD_DECK_POLICY): boolean {
  const unique = [...new Set(elements)];
  return unique.length <= policy.maxElements || policy.allowedCombinations.some(
    (pair) => unique.every((element) => pair.includes(element)),
  );
}

export function compatibleDeck(kinds: readonly CardKind[], policy = STANDARD_DECK_POLICY): boolean {
  const elements = kinds.map((kind) => CARD_COLLECTION[kind])
    .filter((id) => !collectionById(id).neutral);
  return compatibleElements(elements, policy);
}
