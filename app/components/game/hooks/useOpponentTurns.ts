import { useEffect, type Dispatch, type SetStateAction } from "react";
import { chooseBotCard, chooseBotCardTarget, chooseBotTarget, chooseRandomTarget } from "../../../game/bot-player";
import { endTurn, placeFigure, playCard, type GameState } from "../../../game/engine";
import { getRoguelikeStage, type RoguelikeRun } from "../../../game/roguelike";
import type { GameMode } from "../types";
import type { PlaySound } from "./useGameAudio";

type OpponentTurnOptions = {
  game: GameState;
  mode: GameMode;
  pauseOpen: boolean;
  playSfx: PlaySound;
  random?: () => number;
  roguelike: RoguelikeRun | null;
  screen: string;
  setGame: Dispatch<SetStateAction<GameState>>;
  setRoguelike: Dispatch<SetStateAction<RoguelikeRun | null>>;
};

export function useOpponentTurns(options: OpponentTurnOptions) {
  const { game, mode, pauseOpen, playSfx, random = Math.random, roguelike, screen, setGame, setRoguelike } = options;

  useEffect(() => {
    if (
      screen !== "game" ||
      pauseOpen ||
      mode !== "bot" ||
      game.turn !== 2 ||
      game.phase !== "playing"
    ) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setGame((current) => {
        if (current.turn !== 2 || current.phase !== "playing") return current;
        if (current.cardsPlayedThisTurn >= 2) return endTurn(current);
        const target = chooseBotTarget(current);
        const card = chooseBotCard(current, target);
        if (!card) return endTurn(current);
        const next = playCard(current, card.id, chooseBotCardTarget(current, card, target));
        return next === current ? endTurn(current) : next;
      });
    }, 560);
    return () => window.clearTimeout(timeout);
  }, [game, mode, pauseOpen, screen, setGame]);

  useEffect(() => {
    if (
      screen !== "game" ||
      pauseOpen ||
      mode !== "roguelike" ||
      !roguelike ||
      roguelike.status !== "playing" ||
      game.turn !== 2 ||
      game.phase !== "playing"
    ) {
      return;
    }

    const timeout = window.setTimeout(() => {
      if (roguelike.enemyMovesRemaining <= 0) {
        setGame((current) => endTurn(current));
        return;
      }
      const stage = getRoguelikeStage(roguelike.stageIndex);
      const target = roguelike.enemyMovesRemaining > stage.randomFigures
        ? chooseBotTarget(game)
        : chooseRandomTarget(game, random);
      if (target === null) {
        setRoguelike((current) => current ? { ...current, enemyMovesRemaining: 0 } : null);
        setGame((current) => endTurn(current));
        return;
      }
      setGame((current) => placeFigure(current, target));
      setRoguelike((current) => current ? {
        ...current,
        enemyMovesRemaining: current.enemyMovesRemaining - 1,
        enemyFiguresPlaced: current.enemyFiguresPlaced + 1,
      } : null);
      playSfx("placeScale", 0.48);
    }, 520);
    return () => window.clearTimeout(timeout);
  }, [game, mode, pauseOpen, playSfx, random, roguelike, screen, setGame, setRoguelike]);
}
