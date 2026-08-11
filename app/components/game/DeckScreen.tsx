import { CARD_COUNTS, CARD_DEFINITIONS, DECK_BUILDING_KINDS, type CardKind } from "../../game/cards";

type DeckScreenProps = {
  selectedKinds: CardKind[];
  unlockedKinds: CardKind[];
  onBack: () => void;
  onToggle: (kind: CardKind) => void;
  onSave: () => void;
};

export function DeckScreen({ selectedKinds, unlockedKinds, onBack, onToggle, onSave }: DeckScreenProps) {
  const cardCount = selectedKinds.reduce((total, kind) => total + CARD_COUNTS[kind], 0);

  return (
    <main className="collection-shell">
      <header className="collection-header">
        <button className="back-button" onClick={onBack} aria-label="Назад в меню">←</button>
        <div>
          <span>Колода</span>
          <h1>Соберите свою колоду</h1>
        </div>
        <strong>{selectedKinds.length}/16</strong>
      </header>
      <p className="collection-lead">
        Выберите минимум 5 видов карт. Базовая карта «Поставить фигуру» добавляется в пяти экземплярах.
      </p>
      <section className="collection-grid">
        {DECK_BUILDING_KINDS.map((kind) => {
          const definition = CARD_DEFINITIONS[kind];
          const selected = selectedKinds.includes(kind);
          const locked = !unlockedKinds.includes(kind);
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
              <strong>{definition.name}</strong>
              <small>{definition.description}</small>
              {CARD_COUNTS[kind] > 1 && <span className="collection-count">×{CARD_COUNTS[kind]}</span>}
              <span className="collection-check" aria-hidden="true">{locked ? "🔒" : selected ? "✓" : "+"}</span>
            </button>
          );
        })}
      </section>
      <footer className="collection-footer">
        <span>В колоде экземпляров: {cardCount}</span>
        <button className="primary-button" onClick={onSave}>Сохранить колоду</button>
      </footer>
    </main>
  );
}
