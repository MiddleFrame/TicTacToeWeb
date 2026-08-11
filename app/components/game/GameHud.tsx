import Image from "next/image";
import type { CSSProperties, PointerEvent, RefObject } from "react";
import { CARD_DEFINITIONS } from "../../game/cards";
import { cardCost, type GameState, type Player } from "../../game/engine";
import { Figure } from "./Primitives";
import type { DamageFlight, DragState } from "./types";

type HealthBarProps = {
  game: GameState;
  player: Player;
  placement: "enemy" | "player";
  remaining: number;
  trackRef: (node: HTMLDivElement | null) => void;
};

export function HealthBar({ game, player, placement, remaining, trackRef }: HealthBarProps) {
  return (
    <section className={`unity-health ${placement} ${game.turn === player ? "active" : ""}`} aria-label={`Здоровье игрока ${player}`}>
      {placement === "enemy" && (
        <div className="unity-health-meta" aria-label={`Сейчас ходят ${game.turn === 1 ? "крестики" : "нолики"}`}>
          <span>Ход</span>
          <Figure player={game.turn} small />
        </div>
      )}
      {placement === "player" && <strong>{remaining}/{game.scoreToWin}</strong>}
      <div className="unity-health-track" ref={trackRef}>
        <span style={{ width: `${(remaining / game.scoreToWin) * 100}%` }} />
      </div>
      {placement === "enemy" && <strong>{remaining}/{game.scoreToWin}</strong>}
    </section>
  );
}

type BoardProps = {
  game: GameState;
  drag: DragState | null;
  boardRef: RefObject<HTMLDivElement | null>;
  setCellRef: (index: number, node: HTMLButtonElement | null) => void;
  canTarget: (cardId: string, index: number) => boolean;
  flights: DamageFlight[];
};

export function GameBoard({ game, drag, boardRef, setCellRef, canTarget, flights }: BoardProps) {
  return (
    <div className={`unity-board-wrap ${drag?.overField ? "drag-over" : ""}`}>
      <div
        className="board unity-board"
        ref={boardRef}
        style={{ "--board-size": game.size } as CSSProperties}
        role="grid"
        aria-label={`Игровое поле ${game.size} на ${game.size}`}
      >
        {game.board.map((cell, index) => {
          const clearing = game.clearingCells.includes(index);
          const thawing = game.thawingCells.includes(index);
          const frozen = game.frozen[index];
          const targetable = drag ? canTarget(drag.cardId, index) : false;
          const hovered = drag?.hoverIndex === index;
          const flight = flights.find((current) => current.index === index);
          return (
            <button
              className={`cell ${cell ? `has-player-${cell}` : ""} ${clearing ? "clearing" : ""} ${thawing ? "thawing" : ""} ${frozen ? "frozen" : ""} ${targetable ? "targetable" : ""} ${hovered ? "drag-hover" : ""}`}
              data-cell-index={index}
              disabled={!targetable}
              key={index}
              ref={(node) => setCellRef(index, node)}
              role="gridcell"
              aria-label={frozen ? `Замороженная клетка, осталось ходов: ${frozen.turns}` : cell ? `Игрок ${cell}, клетка ${index + 1}` : `Пустая клетка ${index + 1}`}
            >
              {cell && (
                <Figure
                  player={cell}
                  className={flight ? "field-figure-flying" : ""}
                  style={flight ? {
                    "--flight-dx": `${flight.dx}px`,
                    "--flight-dy": `${flight.dy}px`,
                    "--flight-delay": `${flight.delay}ms`,
                  } as CSSProperties : undefined}
                />
              )}
              {(frozen || thawing) && (
                <>
                  <span className="ice-image" aria-hidden="true" />
                  {frozen && <span className="freeze-turns" aria-hidden="true">{frozen.turns}</span>}
                </>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

type ControlsProps = {
  game: GameState;
  disabled: boolean;
  onRechange: () => void;
  onEndTurn: () => void;
};

export function GameControls({ game, disabled, onRechange, onEndTurn }: ControlsProps) {
  const rechangeDisabled = disabled || game.phase !== "playing" || !game.rechangerAvailable[game.turn] || game.hands[game.turn].length === 0 || game.decks[game.turn].length === 0;
  return (
    <section className="unity-controls">
      <div className="unity-mana">
        <strong>{game.mana}/{game.maxMana}</strong>
        <div aria-label={`Мана: ${game.mana} из ${game.maxMana}`}>
          {Array.from({ length: game.maxMana }, (_, index) => <span className={index < game.mana ? "filled" : ""} key={index} />)}
        </div>
      </div>
      <button className="unity-rechange" disabled={rechangeDisabled} onClick={onRechange} aria-label="Заменить карту">↻</button>
      <button className="unity-end-turn" disabled={disabled || game.phase !== "playing"} onClick={onEndTurn}>Конец хода</button>
    </section>
  );
}

type HandProps = {
  game: GameState;
  player: Player;
  disabled: boolean;
  drag: DragState | null;
  onPointerDown: (event: PointerEvent<HTMLButtonElement>, cardId: string) => void;
  onPointerMove: (event: PointerEvent<HTMLButtonElement>, cardId: string) => void;
  onPointerUp: (event: PointerEvent<HTMLButtonElement>, cardId: string) => void;
  onPointerCancel: (cardId: string) => void;
};

export function GameHand(props: HandProps) {
  const hand = props.game.hands[props.player];
  return (
    <section className="unity-hand-zone" aria-label="Карты в руке">
      <div className="unity-hand-cards">
        {hand.map((card, index) => {
          const definition = CARD_DEFINITIONS[card.kind];
          const cost = cardCost(props.game, card);
          const unavailable = props.disabled || props.player !== props.game.turn || cost > props.game.mana || props.game.phase !== "playing";
          const dragging = props.drag?.cardId === card.id;
          return (
            <button
              className={`unity-hand-card ${dragging ? "dragging" : ""} ${dragging && props.drag?.returning ? "returning" : ""} ${unavailable ? "unavailable" : ""}`}
              disabled={unavailable}
              key={card.id}
              onPointerDown={(event) => props.onPointerDown(event, card.id)}
              onPointerMove={(event) => props.onPointerMove(event, card.id)}
              onPointerUp={(event) => props.onPointerUp(event, card.id)}
              onPointerCancel={() => props.onPointerCancel(card.id)}
              style={{
                "--fan-index": index,
                "--fan-center": (hand.length - 1) / 2,
                "--fan-depth": Math.abs(index - (hand.length - 1) / 2),
                "--drag-x": props.drag ? `${props.drag.x}px` : undefined,
                "--drag-y": props.drag ? `${props.drag.y}px` : undefined,
              } as CSSProperties}
              aria-label={`${definition.name}. Стоимость ${cost}. Перетащите карту на поле. ${definition.description}`}
            >
              <span className="unity-card-cost">{cost}</span>
              <span className="unity-card-art" style={{ backgroundImage: `url("${definition.image[props.player]}")` }} aria-hidden="true" />
              <small>{definition.description}</small>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export function PauseButton({ onClick }: { onClick: () => void }) {
  return (
    <button className="unity-pause-button" onClick={onClick} aria-label="Пауза и меню">
      <Image src="/game/menu/pause.png" alt="" width="64" height="64" unoptimized />
    </button>
  );
}
