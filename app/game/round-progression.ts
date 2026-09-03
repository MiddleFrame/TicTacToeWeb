import { CARD_COUNTS, DECK_BUILDING_KINDS, type CardKind } from "./cards.ts";
import type { GameMode } from "./game-mode.ts";
import { validateDeck } from "./saved-decks.ts";

type RoundDeckRule = {
  cards: (kinds: readonly CardKind[]) => CardKind[];
  valid: (kinds: CardKind[], owned: readonly CardKind[]) => boolean;
};
const configured: RoundDeckRule = {
  cards: (kinds) => kinds.flatMap((kind) => Array.from({ length: CARD_COUNTS[kind] }, () => kind)),
  valid: validateDeck,
};
const exact: RoundDeckRule = {
  cards: (kinds) => [...kinds],
  valid: (kinds) => kinds.length > 0 && kinds.length <= 40,
};
export const ROUND_DECK_RULES: Record<GameMode, RoundDeckRule> = {
  bot: configured, local: configured, online: configured, roguelike: exact,
};

export function validRoundCards(mode: unknown, kinds: unknown, owned: readonly CardKind[]): CardKind[] {
  if (typeof mode !== "string" || !Object.hasOwn(ROUND_DECK_RULES, mode)) throw new Error("invalid-round-mode");
  if (!Array.isArray(kinds) || !kinds.every((kind) => DECK_BUILDING_KINDS.includes(kind))) throw new Error("invalid-round-deck");
  const rule = ROUND_DECK_RULES[mode as GameMode];
  if (!rule.valid(kinds, owned)) throw new Error("invalid-round-deck");
  return rule.cards(kinds);
}
