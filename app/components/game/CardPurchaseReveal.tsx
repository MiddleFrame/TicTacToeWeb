import { useEffect, useRef, useState } from "react";
import { CARD_DEFINITIONS, type CardKind } from "../../game/cards";
import { useLocalization } from "../../game/localization";

const REVEAL_DURATION_MS = 6200;

type CardPurchaseRevealProps = {
  kind: CardKind;
  onClose: () => void;
};

export function CardPurchaseReveal({ kind, onClose }: CardPurchaseRevealProps) {
  const [complete, setComplete] = useState(false);
  const revealRef = useRef<HTMLDivElement | null>(null);
  const { card, t } = useLocalization();
  const definition = CARD_DEFINITIONS[kind];
  const localized = card(kind);

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timeout = window.setTimeout(() => setComplete(true), reducedMotion ? 0 : REVEAL_DURATION_MS);
    return () => window.clearTimeout(timeout);
  }, []);

  const accelerate = () => {
    revealRef.current?.getAnimations({ subtree: true }).forEach((animation) => {
      animation.playbackRate = 5;
    });
  };

  return (
    <div
      className={`modal-backdrop store-reveal-backdrop ${complete ? "complete" : "playing"}`}
      ref={revealRef}
      role="presentation"
      onPointerDown={accelerate}
    >
      <section className="store-reveal-sequence" role="dialog" aria-modal="true" aria-labelledby="store-reveal-title">
        <div className="purchase-reveal-stage">
          <span className="purchase-reveal-orbit orbit-one" aria-hidden="true" />
          <span className="purchase-reveal-orbit orbit-two" aria-hidden="true" />
          <article className="purchase-card">
            <span className="purchase-card-mystery" aria-hidden="true">?</span>
            <span className="purchase-card-cost">{definition.cost}</span>
            <span className="purchase-card-art" style={{ backgroundImage: `url("${definition.image[1]}")` }} aria-hidden="true" />
            <span className="eyebrow">{t("newCard")}</span>
            <h2 id="store-reveal-title">{localized.name}</h2>
            <p>{localized.description}</p>
            <span className="purchase-card-scan" aria-hidden="true" />
          </article>
          <span className="purchase-reveal-flare" aria-hidden="true" />
        </div>
        <span className="purchase-reveal-skip">{t("tapToAccelerate")}</span>
        <button className="primary-button purchase-reveal-close" onAnimationEnd={() => setComplete(true)} onClick={onClose}>{t("toDeck")}</button>
      </section>
    </div>
  );
}
