import { CARD_DEFINITIONS, type CardKind } from "../../game/cards";
import { getRoguelikeStage, type RoguelikeRun } from "../../game/roguelike";
import { useLocalization } from "../../game/localization";

function RewardCard({ kind, onClick }: { kind: CardKind; onClick: () => void }) {
  const card = CARD_DEFINITIONS[kind];
  const { card: localizeCard } = useLocalization();
  const localized = localizeCard(kind);
  return (
    <button className="roguelike-card" onClick={onClick}>
      <span className="roguelike-card-cost">{card.cost}</span>
      <span className="roguelike-card-art" style={{ backgroundImage: `url("${card.image[1]}")` }} />
      <strong>{localized.name}</strong>
      <small>{localized.description}</small>
    </button>
  );
}

type RoguelikeOverlayProps = {
  run: RoguelikeRun;
  onChooseMana: () => void;
  onOpenCards: () => void;
  onChooseReward: (kind: CardKind) => void;
  onReplace: (index: number) => void;
  onRestartDraw: () => void;
  onMenu: () => void;
};

export function RoguelikeOverlay(props: RoguelikeOverlayProps) {
  const { language, t } = useLocalization();
  const l = (ru: string, en: string) => language === "ru" ? ru : en;
  const { run } = props;
  if (run.status === "playing") return null;

  if (run.status === "upgrade") {
    return (
      <div className="modal-backdrop roguelike-backdrop">
        <section className="roguelike-modal">
          <span className="eyebrow">{l("Победа", "Victory")} {run.victories}</span>
          <h2>{l("Выберите улучшение", "Choose an upgrade")}</h2>
          <button className="primary-button" onClick={props.onChooseMana}>{l("+1 к максимальной мане", "+1 maximum mana")}</button>
          <button className="secondary-button" onClick={props.onOpenCards}>{t("newCard")}</button>
        </section>
      </div>
    );
  }

  if (run.status === "reward" || run.status === "replacement") {
    const cards = run.status === "reward" ? run.rewardChoices : run.deck;
    return (
      <div className="modal-backdrop roguelike-backdrop">
        <section className="roguelike-card-modal">
          <span className="eyebrow">{l("Награда за победу", "Victory reward")}</span>
          <h2>{run.status === "reward" ? l("Выберите новую карту", "Choose a new card") : l("Выберите карту для замены", "Choose a card to replace")}</h2>
          <div className={`roguelike-card-grid ${run.status === "replacement" ? "deck-grid" : ""}`}>
            {cards.map((kind, index) => (
              <RewardCard
                kind={kind}
                key={`${run.status}-${kind}-${index}`}
                onClick={() => run.status === "reward" ? props.onChooseReward(kind) : props.onReplace(index)}
              />
            ))}
          </div>
        </section>
      </div>
    );
  }

  if (run.status === "draw") {
    return (
      <div className="modal-backdrop roguelike-backdrop">
        <section className="roguelike-modal">
          <h2>{l("Ничья", "Draw")}</h2>
          <p>{l("Этап будет повторён без потери забега.", "The stage will restart without ending the run.")}</p>
          <button className="primary-button" onClick={props.onRestartDraw}>{l("Повторить этап", "Retry stage")}</button>
          <button className="secondary-button" onClick={props.onMenu}>{t("mainMenu")}</button>
        </section>
      </div>
    );
  }

  const stage = getRoguelikeStage(run.stageIndex);
  return (
    <div className="modal-backdrop roguelike-backdrop">
      <section className="roguelike-modal roguelike-summary">
        <h2>{l("Забег окончен", "Run over")}</h2>
        <dl>
          <div><dt>{l("Побед", "Victories")}</dt><dd>{run.victories}</dd></div>
          <div><dt>{l("Сыграно карт", "Cards played")}</dt><dd>{run.cardsPlayed}</dd></div>
          <div><dt>{l("Фигур поставлено", "Figures placed")}</dt><dd>{run.playerFiguresPlaced}</dd></div>
          <div><dt>{l("Фигур врага", "Enemy figures")}</dt><dd>{run.enemyFiguresPlaced}</dd></div>
          <div><dt>{l("Макс. мана", "Maximum mana")}</dt><dd>{run.maximumMana}</dd></div>
          <div><dt>{l("Итоговое поле", "Final board")}</dt><dd>{stage.boardSize}×{stage.boardSize}</dd></div>
        </dl>
        <button className="secondary-button menu-return-button" onClick={props.onMenu}>{t("mainMenu")}</button>
      </section>
    </div>
  );
}
