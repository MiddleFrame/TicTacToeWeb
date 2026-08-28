import { useEffect, type Dispatch, type SetStateAction } from "react";
import { settleThaw, startNextRound, type GameState, type Player } from "../../../game/engine";
import { onlineRoundAdvanceDelay } from "../../../game/round-transition";
import type { GameMode } from "../types";
import type { PlaySound } from "./useGameAudio";

type GamePhaseEffectsOptions = {
  active: boolean;
  game: GameState;
  mode: GameMode;
  networkSide: Player | null;
  setGame: Dispatch<SetStateAction<GameState>>;
  playSfx: PlaySound;
};

export function useGamePhaseEffects(options: GamePhaseEffectsOptions) {
  const { active, game, mode, networkSide, playSfx, setGame } = options;

  useEffect(() => {
    if (!active || (game.phase !== "round-over" && game.phase !== "game-over")) return;
    const cues = game.roundWinner
      ? [
          window.setTimeout(() => playSfx("placeFill", 0.42), 650),
          window.setTimeout(() => playSfx("impact", 0.62), 1900),
          window.setTimeout(() => playSfx("placeScale", 0.55), 2500),
        ]
      : [
          window.setTimeout(() => playSfx("impact", 0.46), 2780),
          window.setTimeout(() => playSfx("placeScale", 0.42), 3500),
        ];
    return () => cues.forEach((cue) => window.clearTimeout(cue));
  }, [active, game.phase, game.roundWinner, playSfx]);

  useEffect(() => {
    if (mode !== "online" || networkSide !== 1 || game.phase !== "round-over") return;
    const timeout = window.setTimeout(() => {
      setGame((current) => current.phase === "round-over" ? startNextRound(current) : current);
    }, onlineRoundAdvanceDelay(game.roundWinner));
    return () => window.clearTimeout(timeout);
  }, [game.phase, game.roundWinner, mode, networkSide, setGame]);

  useEffect(() => {
    if (!active || game.phase !== "thawing") return;
    const canSettle = mode !== "online" || networkSide === 1;
    const revealTimeout = window.setTimeout(() => playSfx("placeScale", 0.46), 390);
    const settleTimeout = window.setTimeout(() => {
      if (canSettle) setGame((current) => settleThaw(current));
    }, 760);
    return () => {
      window.clearTimeout(revealTimeout);
      window.clearTimeout(settleTimeout);
    };
  }, [active, game.phase, game.thawingCells, mode, networkSide, playSfx, setGame]);
}
