import { useEffect, useState } from "react";
import type { CardKind } from "../../game/cards";
import { useLocalization } from "../../game/localization";
import type { PlayCardDock, StartCardRevealAudio } from "./hooks/useGameAudio";
import { CardDeckTransfer } from "./CardDeckTransfer";
import { CardPurchaseReveal } from "./CardPurchaseReveal";
import { CardPurchaseSummary } from "./CardPurchaseSummary";

type FlowPhase = "revealing" | "summary" | "transferring";

type CardPurchaseFlowProps = {
  kinds: readonly CardKind[];
  onAmbientSuspendedChange: (suspended: boolean) => void;
  onComplete: (lastKind: CardKind) => void;
  playDock: PlayCardDock;
  selectedKinds: readonly CardKind[];
  startAudio: StartCardRevealAudio;
  unlockedKinds: readonly CardKind[];
};

export function CardPurchaseFlow({
  kinds,
  onAmbientSuspendedChange,
  onComplete,
  playDock,
  selectedKinds,
  startAudio,
  unlockedKinds,
}: CardPurchaseFlowProps) {
  const { t } = useLocalization();
  const [phase, setPhase] = useState<FlowPhase>("revealing");
  const [index, setIndex] = useState(0);
  const isLast = index === kinds.length - 1;
  const acceptLabel = isLast
    ? kinds.length === 1 ? t("toDeck") : t("showAllCards")
    : t("nextCard");

  useEffect(() => {
    const suspended = phase === "revealing";
    onAmbientSuspendedChange(suspended);
    return () => onAmbientSuspendedChange(false);
  }, [onAmbientSuspendedChange, phase]);

  const acceptReveal = () => {
    if (!isLast) {
      setIndex((current) => current + 1);
      return;
    }
    setPhase(kinds.length === 1 ? "transferring" : "summary");
  };

  if (phase === "summary") {
    return <CardPurchaseSummary kinds={kinds} onConfirm={() => setPhase("transferring")} />;
  }

  if (phase === "transferring") {
    return (
      <CardDeckTransfer
        kinds={kinds}
        onComplete={onComplete}
        playDock={playDock}
        selectedKinds={selectedKinds}
        unlockedKinds={unlockedKinds}
      />
    );
  }

  return (
    <CardPurchaseReveal
      acceptLabel={acceptLabel}
      current={index + 1}
      kind={kinds[index]}
      onAccept={acceptReveal}
      startAudio={startAudio}
      total={kinds.length}
    />
  );
}
