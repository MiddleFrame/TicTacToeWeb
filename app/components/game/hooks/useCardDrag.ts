import { useCallback, useEffect, useRef, useState, type PointerEvent, type RefObject } from "react";
import { CARD_DEFINITIONS } from "../../../game/cards";
import { findClosestCardTarget, resolveCardDrop, type CardDrop } from "../../../game/card-interaction";
import { cardCost, type GameState } from "../../../game/engine";
import type { DragState } from "../types";
import type { PlaySound } from "./useGameAudio";

type PlayCard = (cardId: string, targetIndex?: number) => void;
type CanTarget = (cardId: string, index: number) => boolean;

const CARD_GROW_DURATION_MS = 1200;
const MECHANIC_HINT_DELAY_MS = 1000;
const CARD_RETURN_DURATION_MS = 650;
const CARD_SETTLE_DURATION_MS = 34;

const closestTarget = (
  board: HTMLDivElement | null,
  cardId: string,
  x: number,
  y: number,
  canTarget: CanTarget,
) => {
  const areas = Array.from(board?.querySelectorAll<HTMLElement>("[data-cell-index]") ?? [])
    .map((cell) => {
      const rect = cell.getBoundingClientRect();
      return {
        index: Number(cell.dataset.cellIndex),
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
      };
    })
    .filter((area) => canTarget(cardId, area.index));
  return findClosestCardTarget(x, y, areas);
};

export function useCardDrag(
  game: GameState,
  isEnabled: boolean,
  boardRef: RefObject<HTMLDivElement | null>,
  canTarget: CanTarget,
  playCard: PlayCard,
  playSfx: PlaySound,
) {
  const [drag, setDrag] = useState<DragState | null>(null);
  const mechanicTimer = useRef<number | null>(null);
  const returnTimer = useRef<number | null>(null);

  const clearTimer = (timer: typeof mechanicTimer) => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
  };

  const clearTimers = useCallback(() => {
    clearTimer(mechanicTimer);
    clearTimer(returnTimer);
  }, []);

  const locate = (cardId: string, x: number, y: number) => {
    const boardElement = boardRef.current;
    const board = boardElement?.getBoundingClientRect();
    const overField = Boolean(
      board && x >= board.left && x <= board.right && y >= board.top && y <= board.bottom,
    );
    const element = document.elementFromPoint(x, y);
    const cell = element?.closest<HTMLElement>("[data-cell-index]");
    const index = cell?.dataset.cellIndex ? Number(cell.dataset.cellIndex) : null;
    const directTarget = index !== null && canTarget(cardId, index) ? index : null;
    const gapTarget = index === null && overField
      ? closestTarget(boardElement, cardId, x, y, canTarget)
      : null;
    const hoverIndex = directTarget ?? gapTarget;
    return { overField, hoverIndex };
  };

  const begin = (event: PointerEvent<HTMLButtonElement>, cardId: string) => {
    if (!isEnabled) return;
    const card = game.hands[game.turn].find((item) => item.id === cardId);
    if (!card || cardCost(game, card) > game.mana) return;
    clearTimers();
    playSfx("click", 0.25);
    event.currentTarget.setPointerCapture(event.pointerId);
    const rect = event.currentTarget.getBoundingClientRect();
    const homeX = rect.left + rect.width / 2;
    const homeY = rect.top + rect.height / 2;
    setDrag({
      cardId,
      x: homeX,
      y: homeY,
      homeX,
      homeY,
      homeRotation: Number(event.currentTarget.dataset.fanAngle ?? 0),
      pointerOffsetX: event.clientX - homeX,
      pointerOffsetY: event.clientY - homeY,
      phase: "holding",
      showMechanics: false,
      ...locate(cardId, event.clientX, event.clientY),
    });
    mechanicTimer.current = window.setTimeout(() => {
      setDrag((current) => current?.cardId === cardId && current.phase === "holding"
        ? { ...current, showMechanics: true }
        : current);
      mechanicTimer.current = null;
    }, CARD_GROW_DURATION_MS + MECHANIC_HINT_DELAY_MS);
  };

  const move = (event: PointerEvent<HTMLButtonElement>, cardId: string) => {
    const location = locate(cardId, event.clientX, event.clientY);
    if (location.overField) clearTimer(mechanicTimer);
    setDrag((current) => current?.cardId === cardId && current.phase === "holding"
      ? {
          ...current,
          x: event.clientX - current.pointerOffsetX,
          y: event.clientY - current.pointerOffsetY,
          showMechanics: location.overField ? false : current.showMechanics,
          ...location,
        }
      : current);
  };

  const cancel = (cardId: string) => {
    clearTimer(mechanicTimer);
    clearTimer(returnTimer);
    setDrag((current) => current?.cardId === cardId
      ? {
          ...current,
          x: current.homeX,
          y: current.homeY,
          hoverIndex: null,
          overField: false,
          phase: "returning",
          showMechanics: false,
        }
      : current);
    returnTimer.current = window.setTimeout(() => {
      setDrag((current) => current?.cardId === cardId && current.phase === "returning"
        ? { ...current, phase: "settled" }
        : current);
      returnTimer.current = window.setTimeout(() => {
        setDrag((current) => current?.cardId === cardId && current.phase === "settled" ? null : current);
        returnTimer.current = null;
      }, CARD_SETTLE_DURATION_MS);
    }, CARD_RETURN_DURATION_MS);
  };

  const finish = (event: PointerEvent<HTMLButtonElement>, cardId: string) => {
    if (drag?.cardId !== cardId || drag.phase !== "holding") return;
    const card = game.hands[game.turn].find((item) => item.id === cardId);
    const location = locate(cardId, event.clientX, event.clientY);
    const drop: CardDrop = card
      ? resolveCardDrop(CARD_DEFINITIONS[card.kind].target, location)
      : { type: "cancel" };
    const handlers: Record<CardDrop["type"], () => void> = {
      cancel: () => cancel(cardId),
      play: () => {
        clearTimers();
        setDrag(null);
        playCard(cardId, drop.type === "play" ? drop.targetIndex : undefined);
      },
    };
    handlers[drop.type]();
  };

  const clearDrag = useCallback(() => {
    clearTimers();
    setDrag(null);
  }, [clearTimers]);

  useEffect(() => clearTimers, [clearTimers]);

  return { drag, begin, move, finish, cancel, clearDrag };
}
