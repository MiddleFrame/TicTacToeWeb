import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { CARD_DEFINITIONS, type CardKind } from "../../game/cards";
import { cardRevealProfile } from "../../game/card-reveal-profile";
import type { CardRevealAudioController } from "../../game/card-reveal-audio";
import { useLocalization } from "../../game/localization";
import type { StartCardRevealAudio } from "./hooks/useGameAudio";
import { CardRevealCover } from "./CardRevealCover";

type CardPurchaseRevealProps = {
  acceptLabel: string;
  current: number;
  kind: CardKind;
  onAccept: () => void;
  startAudio: StartCardRevealAudio;
  total: number;
};

export function CardPurchaseReveal({ acceptLabel, current, kind, onAccept, startAudio, total }: CardPurchaseRevealProps) {
  const [complete, setComplete] = useState(false);
  const revealRef = useRef<HTMLDivElement | null>(null);
  const audioRef = useRef<CardRevealAudioController | null>(null);
  const { card, t } = useLocalization();
  const definition = CARD_DEFINITIONS[kind];
  const localized = card(kind);
  const profile = useMemo(() => cardRevealProfile(kind), [kind]);

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    audioRef.current = reducedMotion ? null : startAudio(profile);
    revealRef.current?.getAnimations({ subtree: true }).forEach((animation) => {
      animation.playbackRate = profile.playbackRate;
    });
    const timeout = window.setTimeout(
      () => setComplete(true),
      reducedMotion ? 0 : profile.durationMs / profile.playbackRate + 300,
    );
    return () => {
      window.clearTimeout(timeout);
      audioRef.current?.stop();
      audioRef.current = null;
    };
  }, [profile, startAudio]);

  useEffect(() => {
    if (!complete) return;
    audioRef.current?.stop();
    audioRef.current = null;
  }, [complete]);

  const accelerate = () => {
    revealRef.current?.getAnimations({ subtree: true }).forEach((animation) => {
      animation.playbackRate = profile.playbackRate * 5;
    });
    audioRef.current?.accelerate(5);
  };

  const accept = () => {
    setComplete(false);
    onAccept();
  };

  const revealStyle = {
    "--reveal-accent-rgb": profile.accentRgb,
    "--reveal-card-width": `${238 * profile.scale}px`,
    "--reveal-glow-alpha": profile.glowAlpha,
  } as CSSProperties;

  return (
    <div
      className={`modal-backdrop store-reveal-backdrop reveal-${profile.rarity} reveal-${profile.accent} ${complete ? "complete" : "playing"}`}
      ref={revealRef}
      role="presentation"
      style={revealStyle}
      onPointerDown={accelerate}
    >
      <section className="store-reveal-sequence" key={`${current}-${kind}`} role="dialog" aria-modal="true" aria-labelledby="store-reveal-title">
        <strong className="purchase-reveal-progress">{current}/{total}</strong>
        <div className="purchase-reveal-stage">
          <span className="purchase-reveal-orbit orbit-one" aria-hidden="true" />
          <span className="purchase-reveal-orbit orbit-two" aria-hidden="true" />
          <article className="purchase-card">
            <CardRevealCover variant={profile.accent} />
            <span className="purchase-card-cost">{definition.cost}</span>
            <span className="purchase-card-art" style={{ backgroundImage: `url("${definition.image[1]}")` }} aria-hidden="true" />
            <span className="eyebrow">{t("newCard")}</span>
            <h2 id="store-reveal-title">{localized.name}</h2>
            <p>{localized.description}</p>
            <span className="purchase-card-scan-mask" aria-hidden="true">
              <span className="purchase-card-scan" />
            </span>
          </article>
          <span className="purchase-reveal-flare" aria-hidden="true" />
        </div>
        <span className="purchase-reveal-skip">{t("tapToAccelerate")}</span>
        <button className="primary-button purchase-reveal-close" onAnimationEnd={() => setComplete(true)} onClick={accept}>{acceptLabel}</button>
      </section>
    </div>
  );
}
