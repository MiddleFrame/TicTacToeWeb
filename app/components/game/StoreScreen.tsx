import type { CardKind } from "../../game/cards";
import { cardPackCost } from "../../game/card-purchase";
import { useLocalization } from "../../game/localization";
import type { PlayCardDock, StartCardRevealAudio } from "./hooks/useGameAudio";
import { CardPurchaseFlow } from "./CardPurchaseFlow";
import { Image } from "./Image";

type StoreScreenProps = {
  coins: number;
  lockedKinds: CardKind[];
  purchasedKinds: CardKind[];
  selectedKinds: CardKind[];
  unlockedKinds: CardKind[];
  onAmbientSuspendedChange: (suspended: boolean) => void;
  onBack: () => void;
  onBuy: (count: number) => void;
  onCompleteReveal: (lastKind: CardKind) => void;
  playDock: PlayCardDock;
  startRevealAudio: StartCardRevealAudio;
};

export function StoreScreen(props: StoreScreenProps) {
  const { t } = useLocalization();
  const soldOut = props.lockedKinds.length === 0;
  const canBuyOne = props.coins >= cardPackCost(1) && props.lockedKinds.length >= 1;
  const canBuyFive = props.coins >= cardPackCost(5) && props.lockedKinds.length >= 5;
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
        <div className="store-buy-actions">
          <button className="primary-button store-buy-button" disabled={!canBuyOne} onClick={() => props.onBuy(1)}>
            {canBuyOne ? t("buy50") : soldOut ? t("soldOut") : t("notEnough")}
            {!soldOut && <Image src="/game/menu/coin.png" alt="" width="24" height="24" unoptimized />}
          </button>
          <button className="secondary-button store-buy-button store-pack-button" disabled={!canBuyFive} onClick={() => props.onBuy(5)}>
            {t("buyFive")}
            <span>250</span>
            <Image src="/game/menu/coin.png" alt="" width="22" height="22" unoptimized />
          </button>
        </div>
      </section>
      {props.purchasedKinds.length > 0 && (
        <CardPurchaseFlow
          key={props.purchasedKinds.join("-")}
          kinds={props.purchasedKinds}
          onAmbientSuspendedChange={props.onAmbientSuspendedChange}
          onComplete={props.onCompleteReveal}
          playDock={props.playDock}
          selectedKinds={props.selectedKinds}
          startAudio={props.startRevealAudio}
          unlockedKinds={props.unlockedKinds}
        />
      )}
    </main>
  );
}
