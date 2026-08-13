import Image from "next/image";
import type { CardKind } from "../../game/cards";
import { useLocalization } from "../../game/localization";
import { CardPurchaseReveal } from "./CardPurchaseReveal";

type StoreScreenProps = {
  coins: number;
  lockedKinds: CardKind[];
  purchasedKind: CardKind | null;
  onBack: () => void;
  onBuy: () => void;
  onCloseReveal: () => void;
};

export function StoreScreen(props: StoreScreenProps) {
  const { t } = useLocalization();
  const soldOut = props.lockedKinds.length === 0;
  const canBuy = props.coins >= 50 && !soldOut;
  return (
    <main className="store-shell">
      <header className="section-screen-header">
        <button className="back-button" onClick={props.onBack} aria-label={t("back")}>←</button>
        <div>
          <span>{t("store")}</span>
          <h1>{t("newCards")}</h1>
        </div>
        <strong className="store-coins">
          {props.coins}
          <Image src="/game/menu/coin.png" alt="" width="25" height="25" unoptimized />
        </strong>
      </header>
      <section className="store-card-panel">
        <Image className="store-cart" src="/game/menu/store.png" alt="" width="128" height="112" unoptimized />
        <span className="eyebrow">{t("randomCard")}</span>
        <h2>{soldOut ? t("collectionComplete") : t("openNewCard")}</h2>
        <p>{soldOut ? t("allUnlocked") : t("boughtToDeck")}</p>
        <button className="primary-button store-buy-button" disabled={!canBuy} onClick={props.onBuy}>
          {canBuy ? t("buy50") : soldOut ? t("soldOut") : t("notEnough")}
          {!soldOut && <Image src="/game/menu/coin.png" alt="" width="24" height="24" unoptimized />}
        </button>
      </section>
      {props.purchasedKind && (
        <CardPurchaseReveal
          key={props.purchasedKind}
          kind={props.purchasedKind}
          onClose={props.onCloseReveal}
        />
      )}
    </main>
  );
}
