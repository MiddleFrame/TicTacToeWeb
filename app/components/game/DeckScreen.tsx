import { useEffect, useRef, useState } from "react";
import { CARD_COUNTS, type CardKind } from "../../game/cards";
import { useLocalization } from "../../game/localization";
import { DeckCardGrid } from "./DeckCardGrid";
import { DeckCardInspection, type CardInspectionOrigin } from "./DeckCardInspection";

type DeckScreenProps = {
  selectedKinds: CardKind[];
  unlockedKinds: CardKind[];
  onBack: () => void;
  onToggle: (kind: CardKind) => void;
  onSave: () => void;
  focusKind?: CardKind | null;
};

export function DeckScreen({ selectedKinds, unlockedKinds, onBack, onToggle, onSave, focusKind }: DeckScreenProps) {
  const { t } = useLocalization();
  const shellRef = useRef<HTMLElement | null>(null);
  const [inspection, setInspection] = useState<{ kind: CardKind; origin: CardInspectionOrigin } | null>(null);
  const cardCount = selectedKinds.reduce((total, kind) => total + CARD_COUNTS[kind], 0);

  useEffect(() => {
    if (!focusKind) return;
    shellRef.current?.querySelector<HTMLElement>(`[data-card-kind="${focusKind}"]`)
      ?.scrollIntoView({ block: "center" });
  }, [focusKind]);

  return (
    <main className="collection-shell" ref={shellRef}>
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
      <DeckCardGrid
        onInspect={(kind, origin) => setInspection({ kind, origin })}
        onToggle={onToggle}
        selectedKinds={selectedKinds}
        unlockedKinds={unlockedKinds}
      />
      <footer className="collection-footer">
        <span>{t("deckCopies")}: {cardCount}</span>
        <button className="primary-button" onClick={onSave}>{t("saveDeck")}</button>
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
