import { CARD_COUNTS, CARD_DEFINITIONS, DECK_BUILDING_KINDS, type CardKind } from "../../game/cards";
import { useLocalization } from "../../game/localization";

const HIDDEN_CARD_COPY = {
  name: "???",
  description: "????????????",
};

type DeckCardGridProps = {
  arrivingKinds?: readonly CardKind[];
  landedKinds?: readonly CardKind[];
  onToggle?: (kind: CardKind) => void;
  selectedKinds: readonly CardKind[];
  unlockedKinds: readonly CardKind[];
};

export function DeckCardGrid({
  arrivingKinds = [],
  landedKinds = [],
  onToggle,
  selectedKinds,
  unlockedKinds,
}: DeckCardGridProps) {
  const { card } = useLocalization();
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
          <button
            className={`collection-card ${selected ? "selected" : ""} ${locked ? "locked" : ""} ${arriving ? "awaiting-arrival" : ""} ${landed ? "arrival-landed" : ""}`}
            data-card-kind={kind}
            key={kind}
            onClick={() => onToggle?.(kind)}
            disabled={locked}
            tabIndex={onToggle ? undefined : -1}
            aria-pressed={selected}
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
          </button>
        );
      })}
    </section>
  );
}
