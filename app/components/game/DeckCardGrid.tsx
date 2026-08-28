import { useEffect, useRef, type PointerEvent } from "react";
import { CARD_COUNTS, CARD_DEFINITIONS, DECK_BUILDING_KINDS, type CardKind } from "../../game/cards";
import { useLocalization } from "../../game/localization";
import type { CardInspectionOrigin } from "./DeckCardInspection";

const HIDDEN_CARD_COPY = {
  name: "???",
  description: "????????????",
};

type DeckCardGridProps = {
  arrivingKinds?: readonly CardKind[];
  landedKinds?: readonly CardKind[];
  kinds?: readonly CardKind[];
  onInspect?: (kind: CardKind, origin: CardInspectionOrigin) => void;
  onToggle?: (kind: CardKind) => void;
  selectedKinds: readonly CardKind[];
  unlockedKinds: readonly CardKind[];
};

export function DeckCardGrid({
  arrivingKinds = [],
  landedKinds = [],
  kinds = DECK_BUILDING_KINDS,
  onInspect,
  onToggle,
  selectedKinds,
  unlockedKinds,
}: DeckCardGridProps) {
  const { card } = useLocalization();
  const holdTimer = useRef<number | null>(null);
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const suppressClick = useRef(false);

  const clearHold = () => {
    if (holdTimer.current !== null) window.clearTimeout(holdTimer.current);
    holdTimer.current = null;
    pointerStart.current = null;
  };

  useEffect(() => () => {
    if (holdTimer.current !== null) window.clearTimeout(holdTimer.current);
  }, []);

  const inspect = (kind: CardKind, element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    onInspect?.(kind, {
      height: rect.height,
      left: rect.left,
      top: rect.top,
      width: rect.width,
    });
  };

  const beginInspection = (event: PointerEvent<HTMLElement>, kind: CardKind) => {
    if (!onInspect || event.button !== 0) return;
    clearHold();
    suppressClick.current = false;
    pointerStart.current = { x: event.clientX, y: event.clientY };
    const element = event.currentTarget;
    holdTimer.current = window.setTimeout(() => {
      suppressClick.current = true;
      inspect(kind, element);
      clearHold();
    }, 520);
  };

  const moveInspection = (event: PointerEvent<HTMLElement>) => {
    const start = pointerStart.current;
    if (!start || Math.hypot(event.clientX - start.x, event.clientY - start.y) <= 12) return;
    suppressClick.current = true;
    clearHold();
  };

  return (
    <section className="collection-grid">
      {kinds.map((kind) => {
        const definition = CARD_DEFINITIONS[kind];
        const localized = card(kind);
        const selected = selectedKinds.includes(kind);
        const locked = !unlockedKinds.includes(kind);
        const arriving = arrivingKinds.includes(kind) && !landedKinds.includes(kind);
        const landed = landedKinds.includes(kind);
        const visibleCopy = locked ? HIDDEN_CARD_COPY : localized;
        return (
          <article
            className={`collection-card ${selected ? "selected" : ""} ${locked ? "locked" : ""} ${arriving ? "awaiting-arrival" : ""} ${landed ? "arrival-landed" : ""}`}
            data-card-kind={kind}
            key={kind}
            onClick={() => {
              if (locked || !onToggle) return;
              if (suppressClick.current) {
                suppressClick.current = false;
                return;
              }
              onToggle(kind);
            }}
            onContextMenu={(event) => {
              if (!onInspect || locked) return;
              event.preventDefault();
              inspect(kind, event.currentTarget);
            }}
            onKeyDown={(event) => {
              if (locked) return;
              if (onInspect && (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10"))) {
                event.preventDefault();
                inspect(kind, event.currentTarget);
                return;
              }
              if (onToggle && (event.key === "Enter" || event.key === " ")) {
                event.preventDefault();
                onToggle(kind);
              }
            }}
            onPointerCancel={() => {
              suppressClick.current = true;
              clearHold();
            }}
            onPointerDown={(event) => {
              if (!locked) beginInspection(event, kind);
            }}
            onPointerMove={moveInspection}
            onPointerUp={clearHold}
            role={!locked && onToggle ? "button" : undefined}
            tabIndex={!locked && (onToggle || onInspect) ? 0 : -1}
            aria-label={!locked && (onToggle || onInspect) ? localized.name : undefined}
            aria-pressed={!locked && onToggle ? selected : undefined}
          >
            <span className="collection-cost">{locked ? "?" : definition.cost}</span>
            <span className="collection-art-circle">
              {locked
                ? <span className="collection-locked-art">?</span>
                : <span className="collection-art" style={{ backgroundImage: `url("${definition.image[1]}")` }} />}
            </span>
            <strong>{visibleCopy.name}</strong>
            <small>{visibleCopy.description}</small>
            {CARD_COUNTS[kind] > 1 && <span className="collection-count">×{CARD_COUNTS[kind]}</span>}
            <span className="collection-check" aria-hidden="true">{locked ? "🔒" : selected ? "✓" : "+"}</span>
          </article>
        );
      })}
    </section>
  );
}
