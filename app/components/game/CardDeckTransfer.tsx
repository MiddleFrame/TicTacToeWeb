import { useEffect, useRef, useState, type CSSProperties } from "react";
import { cardTransferSlot } from "../../game/card-transfer-layout";
import { AnimationSequence } from "../../game/animation-sequence";
import type { CardKind } from "../../game/cards";
import { useLocalization } from "../../game/localization";
import type { PlayCardDock } from "./hooks/useGameAudio";
import { DeckCardGrid } from "./DeckCardGrid";
import { PurchaseCardFace } from "./PurchaseCardFace";

type CardDeckTransferProps = {
  kinds: readonly CardKind[];
  onComplete: (lastKind: CardKind) => void;
  playDock: PlayCardDock;
  selectedKinds: readonly CardKind[];
  unlockedKinds: readonly CardKind[];
};

type EdgePosition = CSSProperties & {
  "--flight-x": string;
  "--flight-rotation": string;
};

function edgePosition(index: number): EdgePosition {
  const slot = cardTransferSlot(index);
  const distance = slot.direction < 0
    ? `calc(-38vw + ${slot.insetPx}px)`
    : `calc(38vw - ${slot.insetPx}px)`;
  return {
    "--flight-x": distance,
    "--flight-rotation": `${slot.rotationDeg}deg`,
  };
}

async function scrollCardIntoView(container: HTMLElement, target: HTMLElement, duration: number, sequence: AnimationSequence) {
  const containerRect = container.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  const start = container.scrollTop;
  const desired = start + targetRect.top - containerRect.top - (container.clientHeight - targetRect.height) / 2;
  const maximum = container.scrollHeight - container.clientHeight;
  const destination = Math.max(0, Math.min(maximum, desired));
  const distance = destination - start;
  if (Math.abs(distance) < 2) return;
  const startedAt = performance.now();
  let progress = 0;
  while (progress < 1 && !sequence.cancelled) {
    await sequence.frame((now) => {
      progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - (1 - progress) ** 3;
      container.scrollTop = start + distance * eased;
    });
  }
}

export function CardDeckTransfer({ kinds, onComplete, playDock, selectedKinds, unlockedKinds }: CardDeckTransferProps) {
  const { t } = useLocalization();
  const [scattered, setScattered] = useState(false);
  const [landedKinds, setLandedKinds] = useState<CardKind[]>([]);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const flightRefs = useRef(new Map<CardKind, HTMLElement>());
  const onCompleteRef = useRef(onComplete);
  const playDockRef = useRef(playDock);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    playDockRef.current = playDock;
  }, [playDock]);

  useEffect(() => {
    const sequence = new AnimationSequence();
    const wait = (duration: number) => sequence.wait(duration);
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const run = async () => {
      if (reducedMotion) {
        setLandedKinds([...kinds]);
        await wait(80);
        if (!sequence.cancelled) onCompleteRef.current(kinds.at(-1)!);
        return;
      }
      await wait(30);
      if (sequence.cancelled) return;
      if (kinds.length > 1) {
        setScattered(true);
        await wait(460);
      }
      const duration = kinds.length === 1 ? 1000 : Math.max(280, 620 - kinds.length * 26);
      for (const kind of kinds) {
        if (sequence.cancelled) return;
        const target = rootRef.current?.querySelector<HTMLElement>(`[data-card-kind="${kind}"]`);
        const scroll = rootRef.current?.querySelector<HTMLElement>(".purchase-deck-scroll");
        if (target && scroll) await scrollCardIntoView(scroll, target, kinds.length === 1 ? 220 : 150, sequence);
        if (!await wait(40) || sequence.cancelled) return;
        const flight = flightRefs.current.get(kind);
        if (!target || !flight) continue;
        const from = flight.getBoundingClientRect();
        const to = target.getBoundingClientRect();
        const animation = flight.animate(
          [
            { left: `${from.left}px`, top: `${from.top}px`, width: `${from.width}px`, height: `${from.height}px`, transform: "none" },
            { left: `${to.left}px`, top: `${to.top}px`, width: `${to.width}px`, height: `${to.height}px`, transform: "none" },
          ],
          { duration, easing: "cubic-bezier(0.2, 0.78, 0.18, 1)", fill: "forwards" },
        );
        if (!await sequence.animate(animation) || sequence.cancelled) return;
        setLandedKinds((current) => [...current, kind]);
        playDockRef.current(kind, 1.15);
        await wait(kinds.length === 1 ? 260 : 90);
      }
      await wait(420);
      if (!sequence.cancelled) onCompleteRef.current(kinds.at(-1)!);
    };
    void run();
    return () => {
      sequence.cancel();
    };
  }, [kinds]);

  return (
    <div className={`purchase-deck-transfer ${kinds.length === 1 ? "single-card" : "multi-card"} ${scattered ? "scattered" : "gathered"}`} ref={rootRef}>
      <div className="purchase-deck-scroll">
        <header className="collection-header purchase-deck-header">
          <span aria-hidden="true" />
          <div>
            <span>{t("deck")}</span>
            <h1>{t("buildDeck")}</h1>
          </div>
          <strong>{selectedKinds.length}/16</strong>
        </header>
        <p className="collection-lead">{t("cardsTakingPlaces")}</p>
        <DeckCardGrid
          arrivingKinds={kinds}
          landedKinds={landedKinds}
          selectedKinds={selectedKinds}
          unlockedKinds={unlockedKinds}
        />
      </div>
      <div className="purchase-flight-layer" aria-hidden="true">
        {kinds.map((kind, index) => (
          <div
            className={`purchase-transfer-card ${landedKinds.includes(kind) ? "has-landed" : ""}`}
            key={kind}
            ref={(node) => {
              if (node) flightRefs.current.set(kind, node);
              else flightRefs.current.delete(kind);
            }}
            style={edgePosition(index)}
          >
            <PurchaseCardFace kind={kind} />
          </div>
        ))}
      </div>
    </div>
  );
}
