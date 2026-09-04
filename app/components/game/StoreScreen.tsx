import { useState, type CSSProperties } from "react";
import { COLLECTIONS, collectionCards } from "../../game/collections";
import { emptyPass, type ElementPasses } from "../../game/element-progression";
import type { CardDrop } from "../../game/card-purchase";
import { progressionCopy } from "../../game/progression-copy";
import { ElementProgress } from "./ElementProgress";
import type { CardKind } from "../../game/cards";
import { CARD_PRICE, cardPackCost } from "../../game/card-purchase";
import { useLocalization } from "../../game/localization";
import type { PlayCardDock, StartCardRevealAudio } from "./hooks/useGameAudio";
import { CardPurchaseFlow } from "./CardPurchaseFlow";
import { Image } from "./Image";
import { BackIcon } from "./Primitives";
import { useRewardedAd } from "./hooks/useRewardedAd";
import { AdPrivacyDialog } from "./AdPrivacyDialog";

type StoreScreenProps = {
  cloudReady: boolean;
  coins: number;
  drops: CardDrop[];
  passes: ElementPasses;
  purchaseError: boolean;
  onDismissReveal: () => void;
  purchasedKinds: CardKind[];
  selectedKinds: CardKind[];
  unlockedKinds: CardKind[];
  onAmbientSuspendedChange: (suspended: boolean) => void;
  onBack: () => void;
  onBuy: (count: number, collectionId: string) => void;
  onRewardAd: () => void;
  onCompleteReveal: (lastKind: CardKind) => void;
  playDock: PlayCardDock;
  startRevealAudio: StartCardRevealAudio;
  transactionPending: boolean;
};

export function StoreScreen(props: StoreScreenProps) {
  const { t, language } = useLocalization();
  const copy = progressionCopy[language];
  const [banner, setBanner] = useState(COLLECTIONS[0].id);
  const buy = (count: number, id: string) => { setBanner(id); props.onBuy(count, id); };
  const rewardedAd = useRewardedAd(props.onRewardAd);
  const canBuy = (count: number) => !props.transactionPending && props.coins >= cardPackCost(count);
  return (
    <main className="store-shell">
      <header className="section-screen-header">
        <button className="back-button" onClick={props.onBack} aria-label={t("back")}><BackIcon /></button>
        <div>
          <span>{t("store")}</span>
          <h1>{t("newCards")}</h1>
        </div>
        <strong className="store-coins">
          {props.coins}
          <Image src="/game/menu/coin.png" alt="" width="25" height="25" unoptimized />
        </strong>
      </header>
      <div className="collection-banners">
        {COLLECTIONS.map((collection) => {
          const remaining = collectionCards(collection.id).filter((kind) => !props.unlockedKinds.includes(kind)).length;
          return <section key={collection.id} className={`collection-banner ${remaining === 0 ? "collection-complete" : ""}`} style={{ "--element-color": collection.color } as CSSProperties}>
            <Image className="banner-art" src={collection.image} alt="" width="100" height="100" unoptimized />
            <h2>{collection.name[language]}</h2>
            <strong>{remaining === 0 ? copy.completed : `${copy.remaining}: ${remaining}`}</strong>
            <p>{copy.duplicates}</p>
            <ElementProgress collectionId={collection.id} xp={(props.passes[collection.id] ?? emptyPass()).xp} />
            <div className="store-buy-actions">
              <button className="primary-button" disabled={!canBuy(1)} onClick={() => buy(1, collection.id)}>{copy.buy} · 50 ◈</button>
              <button className="secondary-button" disabled={!canBuy(5)} onClick={() => buy(5, collection.id)}>5 {copy.cards} · 250 ◈</button>
            </div>
          </section>;
        })}
      </div>
      {!props.cloudReady && <p role="status">{t("progressOffline")}</p>}
      {props.purchaseError && <p role="alert">{copy.failed}</p>}
      <section className="store-ad-panel">
        {rewardedAd.supported && (
          <button
            className="secondary-button store-reward-ad"
            disabled={rewardedAd.showing || rewardedAd.privacyConfigured && !rewardedAd.loaded}
            onClick={rewardedAd.show}
          >
            {rewardedAd.showing
              ? t("adOpening")
              : rewardedAd.loading
                ? t("adLoading")
                : !rewardedAd.privacyConfigured || rewardedAd.loaded
                  ? t("watchAd")
                  : t("adUnavailable")}
            <span>+{CARD_PRICE}</span>
            <Image src="/game/menu/coin.png" alt="" width="22" height="22" unoptimized />
          </button>
        )}
      </section>
      {rewardedAd.privacyOpen && (
        <AdPrivacyDialog
          onCancel={rewardedAd.closePrivacy}
          onConfirm={(settings) => void rewardedAd.configurePrivacy(settings)}
        />
      )}
      {props.purchasedKinds.length > 0 && (
        <CardPurchaseFlow
          key={props.purchasedKinds.join("-")}
          kinds={props.purchasedKinds}
          drops={props.drops}
          passes={props.passes}
          canBuyAgain={canBuy(1)}
          onBuyAgain={() => { props.onDismissReveal(); buy(1, props.drops[0]?.collectionId ?? banner); }}
          onDismiss={props.onDismissReveal}
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
