import { CARD_DEFINITIONS, type CardKind } from "../../game/cards";
import { useLocalization } from "../../game/localization";

type PurchaseCardFaceProps = {
  className?: string;
  kind: CardKind;
};

export function PurchaseCardFace({ className = "", kind }: PurchaseCardFaceProps) {
  const { card } = useLocalization();
  const definition = CARD_DEFINITIONS[kind];
  const localized = card(kind);
  return (
    <article className={`purchase-mini-card ${className}`} data-purchase-kind={kind}>
      <span className="purchase-mini-cost">{definition.cost}</span>
      <span className="purchase-mini-art" style={{ backgroundImage: `url("${definition.image[1]}")` }} aria-hidden="true" />
      <strong>{localized.name}</strong>
      <small>{localized.description}</small>
    </article>
  );
}
