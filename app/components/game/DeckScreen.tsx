import { CARD_COUNTS, CARD_DEFINITIONS, DECK_BUILDING_KINDS, type CardKind } from "../../game/cards";
import { useLocalization } from "../../game/localization";

type DeckScreenProps = {
  selectedKinds: CardKind[];
  unlockedKinds: CardKind[];
  onBack: () => void;
  onToggle: (kind: CardKind) => void;
  onSave: () => void;
};

export function DeckScreen({ selectedKinds, unlockedKinds, onBack, onToggle, onSave }: DeckScreenProps) {
  const { card, t } = useLocalization();
  const cardCount = selectedKinds.reduce((total, kind) => total + CARD_COUNTS[kind], 0);

  return (
    <main className="collection-shell">
      <header className="collection-header">
        <button className="back-button" onClick={onBack} aria-label={t("back")}>←</button>
        <div>
          <span>{t("deck")}</span>
          <h1>{t("buildDeck")}</h1>
        </div>
        <strong>{selectedKinds.length}/16</strong>
      </header>
      <p className="collection-lead">
        {t("deckLead")}
      </p>
      <section className="collection-grid">
        {DECK_BUILDING_KINDS.map((kind) => {
          const definition = CARD_DEFINITIONS[kind];
          const localized = card(kind);
          const selected = selectedKinds.includes(kind);
          const locked = !unlockedKinds.includes(kind);
          const visibleCopy = locked
            ? { name: t("lockedCard"), description: t("lockedCardDescription") }
            : localized;
          return (
            <button
              className={`collection-card ${selected ? "selected" : ""} ${locked ? "locked" : ""}`}
              key={kind}
              onClick={() => onToggle(kind)}
              disabled={locked}
              aria-pressed={selected}
            >
              <span className="collection-cost">{definition.cost}</span>
              <span className="collection-art-circle">
                <span className="collection-art" style={{ backgroundImage: `url("${definition.image[1]}")` }} />
              </span>
              <strong>{visibleCopy.name}</strong>
              <small>{visibleCopy.description}</small>
              {CARD_COUNTS[kind] > 1 && <span className="collection-count">×{CARD_COUNTS[kind]}</span>}
              <span className="collection-check" aria-hidden="true">{locked ? "🔒" : selected ? "✓" : "+"}</span>
            </button>
          );
        })}
      </section>
      <footer className="collection-footer">
        <span>{t("deckCopies")}: {cardCount}</span>
        <button className="primary-button" onClick={onSave}>{t("saveDeck")}</button>
      </footer>
    </main>
  );
}
