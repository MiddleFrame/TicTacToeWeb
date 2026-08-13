import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { CARD_DEFINITIONS, type CardKind } from "../../game/cards";
import { useLocalization } from "../../game/localization";
import { CardMechanicHints } from "./CardMechanicHints";

export type CardInspectionOrigin = {
  height: number;
  left: number;
  top: number;
  width: number;
};

type DeckCardInspectionProps = {
  kind: CardKind;
  onClose: () => void;
  origin: CardInspectionOrigin;
};

function originTransform(origin: CardInspectionOrigin, target: DOMRect) {
  const sourceX = origin.left + origin.width / 2;
  const sourceY = origin.top + origin.height / 2;
  const targetX = target.left + target.width / 2;
  const targetY = target.top + target.height / 2;
  return `translate(${sourceX - targetX}px, ${sourceY - targetY}px) scale(${origin.width / target.width})`;
}

export function DeckCardInspection({ kind, onClose, origin }: DeckCardInspectionProps) {
  const { card, t } = useLocalization();
  const [closing, setClosing] = useState(false);
  const closingRef = useRef(false);
  const backdropRef = useRef<HTMLDivElement | null>(null);
  const cardRef = useRef<HTMLElement | null>(null);
  const definition = CARD_DEFINITIONS[kind];
  const localized = card(kind);

  useLayoutEffect(() => {
    const inspectedCard = cardRef.current;
    if (!inspectedCard) return;
    const transform = originTransform(origin, inspectedCard.getBoundingClientRect());
    const animation = inspectedCard.animate(
      [
        { opacity: 0.72, transform },
        { opacity: 1, transform: "none" },
      ],
      { duration: 520, easing: "cubic-bezier(0.18, 0.82, 0.2, 1)", fill: "both" },
    );
    void animation.finished.then(() => animation.cancel()).catch(() => undefined);
    return () => animation.cancel();
  }, [origin]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const close = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    setClosing(true);
    const inspectedCard = cardRef.current;
    const backdrop = backdropRef.current;
    if (!inspectedCard || !backdrop || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      onClose();
      return;
    }
    inspectedCard.getAnimations().forEach((animation) => animation.cancel());
    const transform = originTransform(origin, inspectedCard.getBoundingClientRect());
    const cardAnimation = inspectedCard.animate(
      [
        { opacity: 1, transform: "none" },
        { opacity: 0.72, transform },
      ],
      { duration: 430, easing: "cubic-bezier(0.4, 0, 0.2, 1)", fill: "forwards" },
    );
    const backdropAnimation = backdrop.animate(
      [{ opacity: 1 }, { opacity: 0 }],
      { duration: 430, easing: "ease", fill: "forwards" },
    );
    void Promise.all([cardAnimation.finished, backdropAnimation.finished])
      .then(onClose)
      .catch(() => onClose());
  }, [onClose, origin]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [close]);

  return (
    <div
      className={`deck-inspection-backdrop ${closing ? "closing" : "open"}`}
      ref={backdropRef}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
      role="presentation"
    >
      <section className="deck-inspection-content" role="dialog" aria-modal="true" aria-label={localized.name}>
        <article className="deck-inspection-card" ref={cardRef}>
          <span className="deck-inspection-cost">{definition.cost}</span>
          <span className="deck-inspection-art" style={{ backgroundImage: `url("${definition.image[1]}")` }} aria-hidden="true" />
          <span className="eyebrow">{t("deck")}</span>
          <h2>{localized.name}</h2>
          <p>{localized.description}</p>
        </article>
        <CardMechanicHints className="deck-inspection-hints" kind={kind} visible />
      </section>
    </div>
  );
}
