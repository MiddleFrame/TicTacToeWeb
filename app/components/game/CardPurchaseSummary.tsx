import type { CardKind } from "../../game/cards";
import { useLocalization } from "../../game/localization";
import { PurchaseCardFace } from "./PurchaseCardFace";

type CardPurchaseSummaryProps = {
  kinds: readonly CardKind[];
  onConfirm: () => void;
};

export function CardPurchaseSummary({ kinds, onConfirm }: CardPurchaseSummaryProps) {
  const { t } = useLocalization();
  return (
    <div className="modal-backdrop purchase-summary-backdrop">
      <section className="purchase-summary" role="dialog" aria-modal="true" aria-labelledby="purchase-summary-title">
        <span className="eyebrow">{t("packOpened")}</span>
        <h2 id="purchase-summary-title">{t("yourNewCards")}</h2>
        <strong className="purchase-summary-count">{kinds.length}</strong>
        <div className="purchase-summary-grid">
          {kinds.map((kind) => <PurchaseCardFace kind={kind} key={kind} />)}
        </div>
        <button className="primary-button" onClick={onConfirm}>{t("placeInDeck")}</button>
      </section>
    </div>
  );
}
