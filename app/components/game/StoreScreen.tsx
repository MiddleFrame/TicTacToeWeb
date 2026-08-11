import Image from "next/image";
import { CARD_DEFINITIONS, type CardKind } from "../../game/cards";

type StoreScreenProps = {
  coins: number;
  lockedKinds: CardKind[];
  purchasedKind: CardKind | null;
  onBack: () => void;
  onBuy: () => void;
  onCloseReveal: () => void;
};

export function StoreScreen(props: StoreScreenProps) {
  const soldOut = props.lockedKinds.length === 0;
  const canBuy = props.coins >= 50 && !soldOut;
  const purchased = props.purchasedKind ? CARD_DEFINITIONS[props.purchasedKind] : null;
  return (
    <main className="store-shell">
      <header className="section-screen-header">
        <button className="back-button" onClick={props.onBack} aria-label="Назад в меню">←</button>
        <div>
          <span>Магазин</span>
          <h1>Новые карты</h1>
        </div>
        <strong className="store-coins">
          {props.coins}
          <Image src="/game/menu/coin.png" alt="" width="25" height="25" unoptimized />
        </strong>
      </header>
      <section className="store-card-panel">
        <Image className="store-cart" src="/game/menu/store.png" alt="" width="128" height="112" unoptimized />
        <span className="eyebrow">Случайная карта</span>
        <h2>{soldOut ? "Коллекция собрана" : "Откройте новую карту"}</h2>
        <p>{soldOut ? "Все доступные карты уже открыты." : `Осталось закрытых карт: ${props.lockedKinds.length}. Купленная карта сразу попадёт в вашу колоду.`}</p>
        <button className="primary-button store-buy-button" disabled={!canBuy} onClick={props.onBuy}>
          {canBuy ? "Купить за 50" : soldOut ? "Всё куплено" : "Недостаточно монет"}
          {!soldOut && <Image src="/game/menu/coin.png" alt="" width="24" height="24" unoptimized />}
        </button>
      </section>
      {purchased && (
        <div className="modal-backdrop store-reveal-backdrop" role="presentation">
          <section className="store-reveal" role="dialog" aria-modal="true" aria-labelledby="store-reveal-title">
            <span className="eyebrow">Новая карта</span>
            <div className="store-reveal-art" style={{ backgroundImage: `url("${purchased.image[1]}")` }} />
            <h2 id="store-reveal-title">{purchased.name}</h2>
            <p>{purchased.description}</p>
            <button className="primary-button" onClick={props.onCloseReveal}>В колоду</button>
          </section>
        </div>
      )}
    </main>
  );
}
