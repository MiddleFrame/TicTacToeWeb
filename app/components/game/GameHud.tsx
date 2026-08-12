import Image from "next/image";
import type { CSSProperties, PointerEvent, RefObject } from "react";
import { CARD_DEFINITIONS } from "../../game/cards";
import { cardCost, type GameState, type Player } from "../../game/engine";
import { useLocalization } from "../../game/localization";
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
  const { t } = useLocalization();
  return (
    <section className={`unity-health ${placement} ${game.turn === player ? "active" : ""}`} aria-label={`${t("health")} ${player}`}>
      {placement === "enemy" && (
        <div className="unity-health-meta" aria-label={`Сейчас ходят ${game.turn === 1 ? "крестики" : "нолики"}`}>
          <span>{t("turn")}</span>
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
  const { t } = useLocalization();
  const draggedCard = drag
    ? game.hands[game.turn].find((card) => card.id === drag.cardId)
    : null;
  const draggedDefinition = draggedCard ? CARD_DEFINITIONS[draggedCard.kind] : null;
  const highlightsField = draggedDefinition?.target === "none";
  return (
    <div className={`unity-board-wrap ${drag?.overField && highlightsField ? "drag-over" : ""}`}>
      <div
        className="board unity-board"
        ref={boardRef}
        style={{ "--board-size": game.size } as CSSProperties}
        role="grid"
        aria-label={`${t("board")} ${game.size} × ${game.size}`}
      >
        {game.board.map((cell, index) => {
          const clearing = game.clearingCells.includes(index);
          const thawing = game.thawingCells.includes(index);
          const frozen = game.frozen[index];
          const targetable = drag ? canTarget(drag.cardId, index) : false;
          const hovered = drag?.hoverIndex === index;
          const flight = flights.find((current) => current.index === index);
          const cellPreview = hovered && draggedCard && draggedDefinition?.target !== "none";
          const figurePreview = cellPreview && draggedCard.kind !== "freeze-cell";
          const icePreview = cellPreview && draggedCard.kind === "freeze-cell";
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
                    "--flight-fade-dx": `${flight.fadeDx}px`,
                    "--flight-fade-dy": `${flight.fadeDy}px`,
                    "--flight-delay": `${flight.delay}ms`,
                  } as CSSProperties : undefined}
                />
              )}
              {figurePreview && <Figure player={game.turn} className="placement-preview" />}
              {icePreview && <span className="ice-image placement-preview-ice" aria-hidden="true" />}
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
  onEndTurn: () => void;
};

export function GameControls({ game, disabled, onEndTurn }: ControlsProps) {
  const { t } = useLocalization();
  return (
    <section className="unity-controls">
      <div className="unity-mana">
        <strong>{game.mana}/{game.maxMana}</strong>
        <div aria-label={`Мана: ${game.mana} из ${game.maxMana}`}>
          {Array.from({ length: game.maxMana }, (_, index) => <span className={index < game.mana ? "filled" : ""} key={index} />)}
        </div>
      </div>
      <button className="unity-end-turn" disabled={disabled || game.phase !== "playing"} onClick={onEndTurn}>{t("endTurn")}</button>
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
  const { card: localizeCard, t } = useLocalization();
  const hand = props.game.hands[props.player];
  return (
    <section className="unity-hand-zone" aria-label={t("hand")}>
      <div className="unity-hand-cards">
        {hand.map((card, index) => {
          const definition = CARD_DEFINITIONS[card.kind];
          const localized = localizeCard(card.kind);
          const cost = cardCost(props.game, card);
          const unavailable = props.disabled || props.player !== props.game.turn || cost > props.game.mana || props.game.phase !== "playing";
          const dragging = props.drag?.cardId === card.id;
          const previewingCell = dragging && props.drag?.hoverIndex !== null && definition.target !== "none";
          return (
            <button
              className={`unity-hand-card ${dragging ? "dragging" : ""} ${previewingCell ? "cell-preview-active" : ""} ${dragging && props.drag?.returning ? "returning" : ""} ${unavailable ? "unavailable" : ""}`}
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
              aria-label={`${localized.name}. ${t("cost")} ${cost}. ${t("dragCard")}. ${localized.description}`}
            >
              <span className="unity-card-cost">{cost}</span>
              <span className="unity-card-art" style={{ backgroundImage: `url("${definition.image[props.player]}")` }} aria-hidden="true" />
              <small>{localized.description}</small>
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
