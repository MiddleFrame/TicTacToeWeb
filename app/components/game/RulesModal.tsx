export function RulesModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="rules-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rules-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className="close-button" aria-label="Закрыть" onClick={onClose}>
          ×
        </button>
        <span className="eyebrow">Правила</span>
        <h2 id="rules-title">Собирайте линии картами</h2>
        <ol>
          <li>В начале хода мана восстанавливается, а игрок добирает две карты — максимум до пяти в руке.</li>
          <li>Можно разыграть несколько карт, пока хватает маны. Цена повторно пришедшей карты растёт до конца хода.</li>
          <li>Линия из трёх и более фигур приносит очко за каждую уникальную клетку, после чего фигуры исчезают.</li>
          <li>Лёд блокирует линии на два ваших хода, а затем превращается в вашу фигуру.</li>
          <li>Раунд заканчивается при 20 очках. Матч выигрывает тот, кто первым возьмёт два раунда.</li>
        </ol>
      </section>
    </div>
  );
}
