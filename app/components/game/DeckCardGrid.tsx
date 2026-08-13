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
  onInspect?: (kind: CardKind, origin: CardInspectionOrigin) => void;
  onToggle?: (kind: CardKind) => void;
  selectedKinds: readonly CardKind[];
  unlockedKinds: readonly CardKind[];
};

export function DeckCardGrid({
  arrivingKinds = [],
  landedKinds = [],
  onInspect,
  onToggle,
  selectedKinds,
  unlockedKinds,
}: DeckCardGridProps) {
  const { card } = useLocalization();
  const holdTimer = useRef<number | null>(null);
  const pointerStart = useRef<{ x: number; y: number } | null>(null);

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
    if (!onInspect) return;
    clearHold();
    pointerStart.current = { x: event.clientX, y: event.clientY };
    if (event.pointerType === "touch" || event.pointerType === "pen") {
      const element = event.currentTarget;
      holdTimer.current = window.setTimeout(() => {
        inspect(kind, element);
        clearHold();
      }, 520);
    }
  };

  const moveInspection = (event: PointerEvent<HTMLElement>) => {
    const start = pointerStart.current;
    if (!start || Math.hypot(event.clientX - start.x, event.clientY - start.y) <= 12) return;
    clearHold();
  };

  const finishInspection = (event: PointerEvent<HTMLElement>, kind: CardKind) => {
    if (event.pointerType === "mouse" && event.button === 0 && pointerStart.current) {
      inspect(kind, event.currentTarget);
    }
    clearHold();
  };

  return (
    <section className="collection-grid">
      {DECK_BUILDING_KINDS.map((kind) => {
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
            onContextMenu={(event) => {
              if (onInspect && !locked) event.preventDefault();
            }}
            onKeyDown={(event) => {
              if (!onInspect || locked || (event.key !== "Enter" && event.key !== " ")) return;
              event.preventDefault();
              inspect(kind, event.currentTarget);
            }}
            onPointerCancel={clearHold}
            onPointerDown={(event) => {
              if (!locked) beginInspection(event, kind);
            }}
            onPointerMove={moveInspection}
            onPointerUp={(event) => {
              if (!locked) finishInspection(event, kind);
            }}
            tabIndex={!locked && onInspect ? 0 : -1}
            aria-label={!locked && onInspect ? localized.name : undefined}
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
            {onToggle && !locked ? (
              <button
                className="collection-check"
                onClick={(event) => {
                  event.stopPropagation();
                  onToggle(kind);
                }}
                onPointerDown={(event) => event.stopPropagation()}
                aria-label={localized.name}
                aria-pressed={selected}
              >
                {selected ? "✓" : "+"}
              </button>
            ) : (
              <span className="collection-check" aria-hidden="true">{locked ? "🔒" : selected ? "✓" : "+"}</span>
            )}
          </article>
        );
      })}
    </section>
  );
}
