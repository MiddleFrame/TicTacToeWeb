import { useEffect, useState } from "react";
import type { CardKind } from "../../game/cards";
import { useLocalization } from "../../game/localization";
import type { PlayCardDock, StartCardRevealAudio } from "./hooks/useGameAudio";
import { CardDeckTransfer } from "./CardDeckTransfer";
import { CardPurchaseReveal } from "./CardPurchaseReveal";
import { DuplicateDust } from "./DuplicateDust";
import type { CardDrop } from "../../game/card-purchase";
import type { ElementPasses } from "../../game/element-progression";
import { progressionCopy } from "../../game/progression-copy";

type FlowPhase = "revealing" | "dust" | "transferring" | "done";

type CardPurchaseFlowProps = {
  kinds: readonly CardKind[];
  drops: readonly CardDrop[];
  passes: ElementPasses;
  onBuyAgain: () => void;
  canBuyAgain: boolean;
  onDismiss: () => void;
  onAmbientSuspendedChange: (suspended: boolean) => void;
  onComplete: (lastKind: CardKind) => void;
  playDock: PlayCardDock;
  selectedKinds: readonly CardKind[];
  startAudio: StartCardRevealAudio;
  unlockedKinds: readonly CardKind[];
};

export function CardPurchaseFlow({
  kinds, drops, passes, onBuyAgain, canBuyAgain, onDismiss,
  onAmbientSuspendedChange,
  onComplete,
  playDock,
  selectedKinds,
  startAudio,
  unlockedKinds,
}: CardPurchaseFlowProps) {
  const { t, language } = useLocalization();
  const [phase, setPhase] = useState<FlowPhase>("revealing");
  const [index, setIndex] = useState(0);
  const isLast = index === kinds.length - 1;
  const copy = progressionCopy[language];
  const freshKinds = drops.filter((drop) => !drop.duplicate).map((drop) => drop.kind);
  const drop = drops[index];
  const acceptLabel = drop.duplicate ? `+${drop.xp} ${copy.xp}` : isLast ? copy.collection : t("nextCard");

  useEffect(() => {
    const suspended = phase === "revealing";
    onAmbientSuspendedChange(suspended);
    return () => onAmbientSuspendedChange(false);
  }, [onAmbientSuspendedChange, phase]);

  const advance = () => {
    if (!isLast) {
      setIndex((current) => current + 1);
      setPhase("revealing");
      return;
    }
    setPhase(freshKinds.length > 0 ? "transferring" : "done");
  };
  const acceptReveal = () => drop.duplicate ? setPhase("dust") : advance();

  if (phase === "dust") {
    const after = drop.xpAfter ?? passes[drop.collectionId].xp;
    return <DuplicateDust drop={drop} before={drop.xpBefore ?? Math.max(0, after - drop.xp)} after={after} onDone={advance} />;
  }
  if (phase === "done") {
    return <div className="modal-backdrop"><section className="dust-panel" role="dialog" aria-modal="true" aria-label={copy.done}>
      <h2>{copy.done}</h2>
      <button className="primary-button" disabled={!canBuyAgain} onClick={onBuyAgain}>{copy.buyAgain} · 50</button>
      {freshKinds.length > 0 && <button className="secondary-button" onClick={() => onComplete(freshKinds.at(-1)!)}>{copy.collection}</button>}
      <button className="secondary-button" onClick={onDismiss}>{t("store")}</button>
    </section></div>;
  }

  if (phase === "transferring") {
    return (
      <CardDeckTransfer
        kinds={freshKinds}
        onComplete={() => setPhase("done")}
        playDock={playDock}
        selectedKinds={selectedKinds}
        unlockedKinds={unlockedKinds}
      />
    );
  }

  return (
    <CardPurchaseReveal
      key={index}
      acceptLabel={acceptLabel}
      current={index + 1}
      kind={kinds[index]}
      onAccept={acceptReveal}
      onRevealed={drop.duplicate ? acceptReveal : undefined}
      startAudio={startAudio}
      total={kinds.length}
    />
  );
}
