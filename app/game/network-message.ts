import { CARD_DEFINITIONS, type CardKind } from "./cards.ts";
import type { GameState, Player } from "./engine.ts";

export type NetworkIntent =
  | { type: "play"; cardId: string; targetIndex?: number }
  | { type: "end-turn" }
  | { type: "rechange" }
  | { type: "next-round" };

type Validator = (value: unknown) => boolean;

const MAX_BOARD_SIZE = 5;
const MAX_CARD_POOL = 64;
const MAX_CARD_ID_LENGTH = 128;
const hasOwn = (value: object, key: PropertyKey) => Object.prototype.hasOwnProperty.call(value, key);
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isCount = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const isPlayer = (value: unknown): value is Player => value === 1 || value === 2;
const isCell = (value: unknown) => value === null || isPlayer(value);
const isBoolean = (value: unknown) => typeof value === "boolean";
const isCardKind = (value: unknown): value is CardKind =>
  typeof value === "string" && hasOwn(CARD_DEFINITIONS, value);
const isCardId = (value: unknown) =>
  typeof value === "string" && value.length > 0 && value.length <= MAX_CARD_ID_LENGTH;

function isArrayOf(value: unknown, maximum: number, validate: Validator): value is unknown[] {
  if (!Array.isArray(value) || value.length > maximum) return false;
  for (let index = 0; index < value.length; index += 1) {
    if (!hasOwn(value, index) || !validate(value[index])) return false;
  }
  return true;
}

function isPlayerPair(value: unknown, validate: Validator) {
  return isRecord(value) && Object.keys(value).length === 2 &&
    hasOwn(value, "1") && hasOwn(value, "2") && validate(value[1]) && validate(value[2]);
}

function isCardPool(value: unknown) {
  return isArrayOf(value, MAX_CARD_POOL, (card) => isRecord(card) &&
    Object.keys(card).length === 2 && hasOwn(card, "id") && hasOwn(card, "kind") &&
    isCardId(card.id) && isCardKind(card.kind));
}

function isBonusCosts(value: unknown) {
  if (!isRecord(value) || Object.keys(value).length > Object.keys(CARD_DEFINITIONS).length * 2) return false;
  return Object.entries(value).every(([key, cost]) =>
    /^[12]:/.test(key) && isCardKind(key.slice(2)) && isCount(cost));
}

function isFrozen(value: unknown) {
  if (!isRecord(value) || Object.keys(value).length > MAX_BOARD_SIZE ** 2) return false;
  return Object.entries(value).every(([key, cell]) => /^(0|[1-9]\d*)$/.test(key) &&
    Number(key) < MAX_BOARD_SIZE ** 2 && isRecord(cell) && Object.keys(cell).length === 2 &&
    hasOwn(cell, "owner") && hasOwn(cell, "turns") && isPlayer(cell.owner) && isCount(cell.turns) && cell.turns > 0);
}

const STATE_FIELDS = {
  size: (value) => isCount(value) && value >= 3 && value <= MAX_BOARD_SIZE,
  board: (value) => isArrayOf(value, MAX_BOARD_SIZE ** 2, isCell),
  turn: isPlayer,
  scores: (value) => isPlayerPair(value, isCount),
  scoreToWin: (value) => isCount(value) && value > 0,
  roundWins: (value) => isPlayerPair(value, isCount),
  completedRounds: isCount,
  singleRound: isBoolean,
  phase: (value) => typeof value === "string" &&
    ["playing", "thawing", "clearing", "round-over", "game-over"].includes(value),
  thawingCells: (value) => isArrayOf(value, MAX_BOARD_SIZE ** 2, isCount),
  clearingCells: (value) => isArrayOf(value, MAX_BOARD_SIZE ** 2, isCount),
  lastGain: isCount,
  roundWinner: isCell,
  gameWinner: isCell,
  mana: isCount,
  manaByPlayer: (value) => isPlayerPair(value, isCount),
  maxMana: isCount,
  deckKinds: (value) => isArrayOf(value, MAX_CARD_POOL, isCardKind),
  hands: (value) => isPlayerPair(value, isCardPool),
  decks: (value) => isPlayerPair(value, isCardPool),
  bonusCosts: isBonusCosts,
  basePlacementCosts: (value) => isPlayerPair(value, isCount),
  frozen: isFrozen,
  randomFigureTurns: (value) => isPlayerPair(value, isCount),
  randomFreezeTurns: (value) => isPlayerPair(value, isCount),
  rechangerAvailable: (value) => isPlayerPair(value, isBoolean),
  cardsPlayedThisTurn: isCount,
  lastAction: (value) => typeof value === "string" && value.length <= 1024,
} satisfies Record<keyof GameState, Validator>;

export function isNetworkGameState(value: unknown): value is GameState {
  if (!isRecord(value) || Object.keys(value).length !== Object.keys(STATE_FIELDS).length) return false;
  if (!Object.entries(STATE_FIELDS).every(([key, validate]) => hasOwn(value, key) && validate(value[key]))) return false;
  const state = value as unknown as GameState;
  const boardLength = state.size ** 2;
  const validIndices = (indices: number[]) => new Set(indices).size === indices.length &&
    indices.every((index) => index < boardLength);
  return state.board.length === boardLength && validIndices(state.thawingCells) &&
    validIndices(state.clearingCells) && Object.keys(state.frozen).every((key) => Number(key) < boardLength) &&
    ([1, 2] as const).every((player) => {
      const cards = [...state.hands[player], ...state.decks[player]];
      return cards.length <= MAX_CARD_POOL && new Set(cards.map((card) => card.id)).size === cards.length;
    });
}

export function isNetworkIntent(value: unknown): value is NetworkIntent {
  if (!isRecord(value) || !hasOwn(value, "type")) return false;
  if (value.type === "play") {
    return Object.keys(value).every((key) => ["type", "cardId", "targetIndex"].includes(key)) &&
      hasOwn(value, "cardId") && isCardId(value.cardId) &&
      (value.targetIndex === undefined || (isCount(value.targetIndex) && value.targetIndex < MAX_BOARD_SIZE ** 2));
  }
  return Object.keys(value).length === 1 &&
    (value.type === "end-turn" || value.type === "rechange" || value.type === "next-round");
}
