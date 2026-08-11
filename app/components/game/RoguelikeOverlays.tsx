import { CARD_DEFINITIONS, type CardKind } from "../../game/cards";
import { getRoguelikeStage, type RoguelikeRun } from "../../game/roguelike";

function RewardCard({ kind, onClick }: { kind: CardKind; onClick: () => void }) {
  const card = CARD_DEFINITIONS[kind];
  return (
    <button className="roguelike-card" onClick={onClick}>
      <span className="roguelike-card-cost">{card.cost}</span>
      <span className="roguelike-card-art" style={{ backgroundImage: `url("${card.image[1]}")` }} />
      <strong>{card.name}</strong>
      <small>{card.description}</small>
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
  const { run } = props;
  if (run.status === "playing") return null;

  if (run.status === "upgrade") {
    return (
      <div className="modal-backdrop roguelike-backdrop">
        <section className="roguelike-modal">
          <span className="eyebrow">Победа {run.victories}</span>
          <h2>Выберите улучшение</h2>
          <button className="primary-button" onClick={props.onChooseMana}>+1 к максимальной мане</button>
          <button className="secondary-button" onClick={props.onOpenCards}>Новая карта</button>
        </section>
      </div>
    );
  }

  if (run.status === "reward" || run.status === "replacement") {
    const cards = run.status === "reward" ? run.rewardChoices : run.deck;
    return (
      <div className="modal-backdrop roguelike-backdrop">
        <section className="roguelike-card-modal">
          <span className="eyebrow">Награда за победу</span>
          <h2>{run.status === "reward" ? "Выберите новую карту" : "Выберите карту для замены"}</h2>
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
          <h2>Ничья</h2>
          <p>Этап будет повторён без потери забега.</p>
          <button className="primary-button" onClick={props.onRestartDraw}>Повторить этап</button>
          <button className="secondary-button" onClick={props.onMenu}>В главное меню</button>
        </section>
      </div>
    );
  }

  const stage = getRoguelikeStage(run.stageIndex);
  return (
    <div className="modal-backdrop roguelike-backdrop">
      <section className="roguelike-modal roguelike-summary">
        <h2>Забег окончен</h2>
        <dl>
          <div><dt>Побед</dt><dd>{run.victories}</dd></div>
          <div><dt>Сыграно карт</dt><dd>{run.cardsPlayed}</dd></div>
          <div><dt>Фигур поставлено</dt><dd>{run.playerFiguresPlaced}</dd></div>
          <div><dt>Фигур врага</dt><dd>{run.enemyFiguresPlaced}</dd></div>
          <div><dt>Макс. мана</dt><dd>{run.maximumMana}</dd></div>
          <div><dt>Итоговое поле</dt><dd>{stage.boardSize}×{stage.boardSize}</dd></div>
        </dl>
        <button className="secondary-button menu-return-button" onClick={props.onMenu}>В главное меню</button>
      </section>
    </div>
  );
}
