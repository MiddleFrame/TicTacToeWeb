import { useCallback, useState, type PointerEvent, type RefObject } from "react";
import { CARD_DEFINITIONS } from "../../../game/cards";
import { cardCost, type GameState } from "../../../game/engine";
import type { DragState } from "../types";
import type { PlaySound } from "./useGameAudio";

type PlayCard = (cardId: string, targetIndex?: number) => void;

export function useCardDrag(
  game: GameState,
  isEnabled: boolean,
  boardRef: RefObject<HTMLDivElement | null>,
  canTarget: (cardId: string, index: number) => boolean,
  playCard: PlayCard,
  playSfx: PlaySound,
) {
  const [drag, setDrag] = useState<DragState | null>(null);

  const locate = (cardId: string, x: number, y: number) => {
    const board = boardRef.current?.getBoundingClientRect();
    const overField = Boolean(
      board && x >= board.left && x <= board.right && y >= board.top && y <= board.bottom,
    );
    const element = document.elementFromPoint(x, y);
    const cell = element?.closest<HTMLElement>("[data-cell-index]");
    const index = cell?.dataset.cellIndex ? Number(cell.dataset.cellIndex) : null;
    const hoverIndex = index !== null && canTarget(cardId, index) ? index : null;
    return { overField, hoverIndex };
  };

  const begin = (event: PointerEvent<HTMLButtonElement>, cardId: string) => {
    if (!isEnabled) return;
    const card = game.hands[game.turn].find((item) => item.id === cardId);
    if (!card || cardCost(game, card) > game.mana) return;
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
      pointerOffsetX: event.clientX - homeX,
      pointerOffsetY: event.clientY - homeY,
      returning: false,
      ...locate(cardId, event.clientX, event.clientY),
    });
  };

  const move = (event: PointerEvent<HTMLButtonElement>, cardId: string) => {
    if (drag?.cardId !== cardId) return;
    setDrag({
      ...drag,
      x: event.clientX - drag.pointerOffsetX,
      y: event.clientY - drag.pointerOffsetY,
      ...locate(cardId, event.clientX, event.clientY),
    });
  };

  const cancel = (cardId: string) => {
    setDrag((current) => current?.cardId === cardId
      ? {
          ...current,
          x: current.homeX,
          y: current.homeY,
          hoverIndex: null,
          overField: false,
          returning: true,
        }
      : current);
    window.setTimeout(() => {
      setDrag((current) => current?.cardId === cardId && current.returning ? null : current);
    }, 205);
  };

  const finish = (event: PointerEvent<HTMLButtonElement>, cardId: string) => {
    if (drag?.cardId !== cardId) return;
    const card = game.hands[game.turn].find((item) => item.id === cardId);
    const target = card ? CARD_DEFINITIONS[card.kind].target : null;
    const location = locate(cardId, event.clientX, event.clientY);
    if (!target || !location.overField) return cancel(cardId);
    if (target === "none") {
      setDrag(null);
      playCard(cardId);
      return;
    }
    if (location.hoverIndex !== null) {
      setDrag(null);
      playCard(cardId, location.hoverIndex);
      return;
    }
    cancel(cardId);
  };

  const clearDrag = useCallback(() => setDrag(null), []);
  return { drag, begin, move, finish, cancel, clearDrag };
}
