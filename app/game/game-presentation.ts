import { CARD_DEFINITIONS } from "./cards.ts";
import { cardCost, type GameState, type Player } from "./engine.ts";
import type { PhotonSnapshot } from "./photon.ts";
import type { GameMode } from "./game-mode.ts";

type StatusKey =
  | "circles"
  | "crosses"
  | "line"
  | "matchDraw"
  | "roundDraw"
  | "thawing"
  | "wonMatch"
  | "wonRound";

export function getGamePlayers(
  mode: GameMode,
  turn: Player,
  networkSide: Player | null,
) {
  const displayedPlayer: Player = mode === "local"
    ? turn
    : mode === "online"
      ? (networkSide ?? 1)
      : 1;
  const topPlayer: Player = displayedPlayer === 1 ? 2 : 1;
  return { bottomPlayer: displayedPlayer, displayedPlayer, topPlayer };
}

export function isHumanGameTurn(
  mode: GameMode,
  game: GameState,
  network: PhotonSnapshot,
): boolean {
  return mode === "local" ||
    ((mode === "bot" || mode === "roguelike") && game.turn === 1) ||
    (mode === "online" && network.phase === "ready" && network.side === game.turn);
}

export function remainingHealth(
  game: GameState,
  player: Player,
  previewDamage: Record<Player, number>,
): number {
  const opponent: Player = player === 1 ? 2 : 1;
  return Math.max(0, game.scoreToWin - game.scores[opponent] - previewDamage[player]);
}

export function canTargetCard(
  game: GameState,
  cardId: string,
  index: number,
  enabled: boolean,
): boolean {
  if (!enabled || game.phase !== "playing" || game.frozen[index]) return false;
  const card = game.hands[game.turn].find((item) => item.id === cardId);
  if (!card || cardCost(game, card) > game.mana) return false;
  const target = CARD_DEFINITIONS[card.kind].target;
  if (target === "empty") return game.board[index] === null;
  if (target === "ally") return game.board[index] === game.turn;
  return false;
}

export function getGameStatus(
  game: GameState,
  translate: (key: StatusKey) => string,
  translateAction: (value: string) => string,
): string {
  const sideName = (player: Player) => player === 1 ? translate("crosses") : translate("circles");
  if (game.phase === "thawing") return translate("thawing");
  if (game.phase === "clearing") return `${translate("line")}! +${game.lastGain}`;
  if (game.phase === "round-over") {
    return game.roundWinner
      ? `${translate("wonRound")} ${sideName(game.roundWinner).toLowerCase()}`
      : translate("roundDraw");
  }
  if (game.phase === "game-over") {
    return game.gameWinner
      ? `${sideName(game.gameWinner)} ${translate("wonMatch")}`
      : translate("matchDraw");
  }
  return translateAction(game.lastAction);
}
