import { useEffect, type Dispatch, type SetStateAction } from "react";
import { settleThaw, type GameState, type Player } from "../../../game/engine";
import { resolveRoguelikeResult, type RoguelikeRun } from "../../../game/roguelike";
import type { GameMode } from "../types";
import type { PlaySound } from "./useGameAudio";

type GamePhaseEffectsOptions = {
  game: GameState;
  mode: GameMode;
  networkSide: Player | null;
  roguelike: RoguelikeRun | null;
  setGame: Dispatch<SetStateAction<GameState>>;
  setRoguelike: Dispatch<SetStateAction<RoguelikeRun | null>>;
  playSfx: PlaySound;
};

export function useGamePhaseEffects(options: GamePhaseEffectsOptions) {
  const { game, mode, networkSide, playSfx, roguelike, setGame, setRoguelike } = options;

  useEffect(() => {
    if (game.phase !== "round-over" && game.phase !== "game-over") return;
    const cues = game.roundWinner
      ? [
          window.setTimeout(() => playSfx("placeFill", 0.42), 850),
          window.setTimeout(() => playSfx("impact", 0.58), 2500),
          window.setTimeout(() => playSfx("placeScale", 0.55), 3300),
        ]
      : [
          window.setTimeout(() => playSfx("impact", 0.36), 2550),
          window.setTimeout(() => playSfx("placeScale", 0.42), 3500),
        ];
    return () => cues.forEach((cue) => window.clearTimeout(cue));
  }, [game.phase, game.roundWinner, playSfx]);

  useEffect(() => {
    if (
      mode !== "roguelike" ||
      game.phase !== "game-over" ||
      !roguelike ||
      roguelike.status !== "playing"
    ) {
      return;
    }
    const timeout = window.setTimeout(
      () => setRoguelike((current) => current ? resolveRoguelikeResult(current, game.gameWinner) : null),
      0,
    );
    return () => window.clearTimeout(timeout);
  }, [game.gameWinner, game.phase, mode, roguelike, setRoguelike]);

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
