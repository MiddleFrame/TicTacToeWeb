import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { settleClear, type GameState, type Player } from "../../../game/engine";
import type { DamageFlight, GameMode } from "../types";
import type { PlaySound } from "./useGameAudio";

const hitMs = 800;
const flightMs = 850;

function buildFlights(
  clearingCells: number[],
  turn: Player,
  score: number,
  cells: Record<number, HTMLButtonElement | null>,
  target: HTMLDivElement | null,
): DamageFlight[] {
  const targetRect = target?.getBoundingClientRect();
  if (!targetRect) return [];
  return clearingCells.flatMap((index, order) => {
    const sourceRect = cells[index]?.getBoundingClientRect();
    if (!sourceRect) return [];
    const x = sourceRect.left + sourceRect.width / 2;
    const y = sourceRect.top + sourceRect.height / 2;
    const dx = targetRect.left + targetRect.width / 2 - x;
    const dy = targetRect.top + targetRect.height / 2 - y;
    return [{
      id: `${turn}-${index}-${score}`,
      index,
      player: turn,
      dx,
      dy,
      fadeDx: dx * 0.94,
      fadeDy: dy * 0.94,
      delay: order * 75,
    }];
  });
}

export function useDamageSequence(
  active: boolean,
  game: GameState,
  mode: GameMode,
  networkSide: Player | null,
  setGame: Dispatch<SetStateAction<GameState>>,
  playSfx: PlaySound,
) {
  const [flights, setFlights] = useState<DamageFlight[]>([]);
  const [previewDamage, setPreviewDamage] = useState<Record<Player, number>>({ 1: 0, 2: 0 });
  const cellRefs = useRef<Record<number, HTMLButtonElement | null>>({});
  const healthRefs = useRef<Record<Player, HTMLDivElement | null>>({ 1: null, 2: null });
  const clearingCells = game.clearingCells;
  const phase = game.phase;
  const scores = game.scores;
  const turn = game.turn;

  useEffect(() => {
    if (!active || phase !== "clearing") return;
    const canSettle = mode !== "online" || networkSide === 1;
    const targetPlayer: Player = turn === 1 ? 2 : 1;
    const nextFlights = buildFlights(clearingCells, turn, scores[turn], cellRefs.current, healthRefs.current[targetPlayer]);
    playSfx("erase", 0.31);
    setFlights(nextFlights);
    setPreviewDamage((current) => ({ ...current, [targetPlayer]: 0 }));
    const impacts = nextFlights.map((flight) => window.setTimeout(() => {
      playSfx("impact", 0.46);
      setPreviewDamage((current) => ({ ...current, [targetPlayer]: current[targetPlayer] + 1 }));
    }, hitMs + flight.delay));
    const settle = window.setTimeout(() => {
      setFlights([]);
      if (canSettle) setGame((current) => settleClear(current));
      setPreviewDamage((current) => ({ ...current, [targetPlayer]: 0 }));
    }, flightMs + Math.max(0, nextFlights.length - 1) * 75);
    return () => {
      window.clearTimeout(settle);
      impacts.forEach((timeout) => window.clearTimeout(timeout));
    };
  }, [active, clearingCells, mode, networkSide, phase, playSfx, scores, setGame, turn]);

  return {
    flights,
    previewDamage,
    clearFlights: () => setFlights([]),
    setCellRef: (index: number, node: HTMLButtonElement | null) => { cellRefs.current[index] = node; },
    setHealthRef: (player: Player, node: HTMLDivElement | null) => { healthRefs.current[player] = node; },
  };
}
