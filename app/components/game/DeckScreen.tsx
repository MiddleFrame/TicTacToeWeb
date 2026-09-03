import { COLLECTIONS } from "../../game/collections";
import { DeckLibraryControls } from "./DeckLibraryControls";
import type { useElementProgression } from "./hooks/useElementProgression";
import { useEffect, useRef, useState } from "react";
import { CARD_COUNTS, type CardKind } from "../../game/cards";
import { deckFilterForCard, deckKindsForFilter, type DeckCardFilter } from "../../game/card-filters";
import { useLocalization } from "../../game/localization";
import { DeckCardGrid } from "./DeckCardGrid";
import { DeckCardInspection, type CardInspectionOrigin } from "./DeckCardInspection";
import { BackIcon } from "./Primitives";

type DeckScreenProps = {
  progression: ReturnType<typeof useElementProgression>;
  selectedKinds: CardKind[];
  unlockedKinds: CardKind[];
  onBack: () => void;
  onToggle: (kind: CardKind) => void;
  onSave: () => void;
  focusKind?: CardKind | null;
};

export function DeckScreen({ progression, selectedKinds, unlockedKinds, onBack, onToggle, onSave, focusKind }: DeckScreenProps) {
  const { t, language } = useLocalization();
  const shellRef = useRef<HTMLElement | null>(null);
  const [filter, setFilter] = useState<DeckCardFilter>(() => focusKind ? deckFilterForCard(focusKind) : "all");
  const [inspection, setInspection] = useState<{ kind: CardKind; origin: CardInspectionOrigin } | null>(null);
  const cardCount = selectedKinds.reduce((total, kind) => total + CARD_COUNTS[kind], 0);
  const visibleKinds = deckKindsForFilter(filter);

  useEffect(() => {
    if (!focusKind) return;
    shellRef.current?.querySelector<HTMLElement>(`[data-card-kind="${focusKind}"]`)
      ?.scrollIntoView({ block: "center" });
  }, [filter, focusKind]);

  return (
    <main className="collection-shell" ref={shellRef}>
      <header className="collection-header deck-header">
        <button className="back-button" onClick={onBack} aria-label={t("back")}><BackIcon /></button>
        <div>
          <span>{t("deck")}</span>
          <h1>{t("buildDeck")}</h1>
        </div>
        <strong>{selectedKinds.length}/16</strong>
      </header>
      <DeckLibraryControls key={progression.deckLibrary.activeId} progression={progression} selectedKinds={selectedKinds} />
      <p className="collection-lead">
        {t("deckLead")}
      </p>
      <nav className="deck-filters" aria-label={t("deckFilters")}>
        {(["all", ...COLLECTIONS.map((collection) => collection.id)] as DeckCardFilter[]).map((value) => (
          <button
            className={filter === value ? "active" : ""}
            key={value}
            onClick={() => setFilter(value)}
            aria-pressed={filter === value}
          >
            {value === "all" ? t("allCards") : COLLECTIONS.find((collection) => collection.id === value)!.name[language]}
          </button>
        ))}
      </nav>
      <DeckCardGrid
        kinds={visibleKinds}
        onInspect={(kind, origin) => setInspection({ kind, origin })}
        onToggle={onToggle}
        selectedKinds={selectedKinds}
        unlockedKinds={unlockedKinds}
      />
      <footer className="collection-footer">
        <span>{t("deckCopies")}: {cardCount}</span>
        <button className="primary-button" disabled={progression.busy} onClick={onSave}>{t("saveDeck")}</button>
      </footer>
      {inspection && (
        <DeckCardInspection
          kind={inspection.kind}
          onClose={() => setInspection(null)}
          origin={inspection.origin}
        />
      )}
    </main>
  );
}
