import { canTargetCardAtCell, type GameState, type Player } from "./engine.ts";
import type { PhotonSnapshot } from "./photon.ts";
import type { GameMode } from "./game-mode.ts";

type StatusKey =
  | "circles"
  | "crosses"
  | "line"
  | "matchDraw"
  | "roundDraw"
  | "roundDefeat"
  | "roundVictory"
  | "thawing"
  | "wonMatch"
  | "wonRound";

export type ResultTone = "victory" | "defeat" | "draw";

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
  return enabled && canTargetCardAtCell(game, cardId, index);
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

export function getRoundResult(
  game: GameState,
  viewer: Player | null,
  translate: (key: StatusKey) => string,
): { headline: string; tone: ResultTone; winner: Player | null } {
  const winner = game.roundWinner;
  if (winner === null) {
    return { headline: translate("roundDraw"), tone: "draw", winner };
  }
  if (viewer === null) {
    const side = winner === 1 ? translate("crosses") : translate("circles");
    return {
      headline: `${translate("wonRound")} ${side.toLowerCase()}`,
      tone: "victory",
      winner,
    };
  }
  return {
    headline: translate(winner === viewer ? "roundVictory" : "roundDefeat"),
    tone: winner === viewer ? "victory" : "defeat",
    winner,
  };
}
