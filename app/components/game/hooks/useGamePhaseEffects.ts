import { useEffect, type Dispatch, type SetStateAction } from "react";
import { settleThaw, type GameState, type Player } from "../../../game/engine";
import type { GameMode } from "../types";
import type { PlaySound } from "./useGameAudio";

type GamePhaseEffectsOptions = {
  game: GameState;
  mode: GameMode;
  networkSide: Player | null;
  setGame: Dispatch<SetStateAction<GameState>>;
  playSfx: PlaySound;
};

export function useGamePhaseEffects(options: GamePhaseEffectsOptions) {
  const { game, mode, networkSide, playSfx, setGame } = options;

  useEffect(() => {
    if (game.phase !== "round-over" && game.phase !== "game-over") return;
    const cues = game.roundWinner
      ? [
          window.setTimeout(() => playSfx("placeFill", 0.42), 850),
          window.setTimeout(() => playSfx("impact", 0.58), 2500),
          window.setTimeout(() => playSfx("placeScale", 0.55), 3300),
        ]
      : [
          window.setTimeout(() => playSfx("impact", 0.46), 2780),
          window.setTimeout(() => playSfx("placeScale", 0.42), 3500),
        ];
    return () => cues.forEach((cue) => window.clearTimeout(cue));
  }, [game.phase, game.roundWinner, playSfx]);

  useEffect(() => {
    if (game.phase !== "thawing") return;
    const canSettle = mode !== "online" || networkSide === 1;
    const revealTimeout = window.setTimeout(() => playSfx("placeScale", 0.46), 390);
    const settleTimeout = window.setTimeout(() => {
      if (canSettle) setGame((current) => settleThaw(current));
    }, 760);
    return () => {
      window.clearTimeout(revealTimeout);
      window.clearTimeout(settleTimeout);
    };
  }, [game.phase, game.thawingCells, mode, networkSide, playSfx, setGame]);
}
