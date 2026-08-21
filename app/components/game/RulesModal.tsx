import { useLocalization } from "../../game/localization";

export function RulesModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { language, t } = useLocalization();
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
        <button className="close-button" aria-label={t("close")} onClick={onClose}>
          ×
        </button>
        <span className="eyebrow">{t("rules")}</span>
        <h2 id="rules-title">{t("rulesTitle")}</h2>
        {language === "ru" ? (
          <ol>
            <li>В начале хода мана восстанавливается, а игрок добирает две карты — максимум до пяти в руке.</li>
            <li>Можно разыграть несколько карт, пока хватает маны. Цена повторно пришедшей карты растёт до конца хода.</li>
            <li>Линия из трёх и более фигур приносит очко за каждую уникальную клетку, после чего фигуры исчезают.</li>
            <li>Лёд блокирует линии на два ваших хода, а затем превращается в вашу фигуру.</li>
            <li>Раунды идут до 10, 15 и 20 очков соответственно. Матч выигрывает тот, кто первым возьмёт два раунда.</li>
          </ol>
        ) : (
          <ol>
            <li>Mana is restored at the start of a turn and the player draws two cards, up to five in hand.</li>
            <li>Play as many cards as your mana allows. A replayed card becomes more expensive until the turn ends.</li>
            <li>A line of three or more figures deals one damage per unique cell, then those figures disappear.</li>
            <li>Ice blocks lines for two of your turns, then becomes your figure.</li>
            <li>Rounds end at 10, 15, and 20 damage respectively. The first player to win two rounds wins the match.</li>
          </ol>
        )}
      </section>
    </div>
  );
}
