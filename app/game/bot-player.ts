import { CARD_DEFINITIONS, type CardInstance } from "./cards";
import { findScoringCells } from "./board-rules";
import { cardCost, type GameState } from "./engine";

export function chooseBotTarget(game: GameState): number | null {
  const available = game.board
    .map((cell, index) => cell === null && !game.frozen[index] ? index : -1)
    .filter((index) => index >= 0);
  if (available.length === 0) return null;
  const center = (game.size - 1) / 2;
  return available.reduce((best, index) => {
    const attackBoard = [...game.board];
    attackBoard[index] = 2;
    const attack = findScoringCells(attackBoard, game.size, 2, game.frozen).length;
    const blockBoard = [...game.board];
    blockBoard[index] = 1;
    const block = findScoringCells(blockBoard, game.size, 1, game.frozen).length;
    const row = Math.floor(index / game.size);
    const column = index % game.size;
    const value = attack * 100 + block * 45 - Math.abs(row - center) - Math.abs(column - center);
    return value > best.value ? { index, value } : best;
  }, { index: available[0], value: Number.NEGATIVE_INFINITY }).index;
}

export function chooseBotCard(game: GameState, target: number | null): CardInstance | undefined {
  return game.hands[2].find((card) => {
    if (cardCost(game, card) > game.mana) return false;
    const targetType = CARD_DEFINITIONS[card.kind].target;
    if (targetType === "empty") return target !== null;
    if (targetType === "ally") return game.board.some((cell) => cell === 2);
    return true;
  });
}

export function chooseBotCardTarget(game: GameState, card: CardInstance, fallback: number | null) {
  const targetType = CARD_DEFINITIONS[card.kind].target;
  if (targetType === "empty") return fallback ?? undefined;
  if (targetType === "ally") return game.board.findIndex((cell) => cell === 2);
  return undefined;
}
