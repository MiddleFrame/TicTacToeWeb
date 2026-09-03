import { useEffect, useRef, useState } from "react";
import type { CardDrop } from "../../game/card-purchase";
import { useLocalization } from "../../game/localization";
import { progressionCopy } from "../../game/progression-copy";
import { ElementProgress } from "./ElementProgress";
import { PurchaseCardFace } from "./PurchaseCardFace";

export function DuplicateDust({ drop, before, after, onDone }: { drop: CardDrop; before: number; after: number; onDone: () => void }) {
  const { language } = useLocalization();
  const copy = progressionCopy[language];
  const [filled, setFilled] = useState(false);
  const complete = useRef(onDone);
  useEffect(() => { complete.current = onDone; }, [onDone]);
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const fill = window.setTimeout(() => setFilled(true), reduced ? 0 : 850);
    const finish = window.setTimeout(() => complete.current(), reduced ? 100 : 2100);
    return () => { window.clearTimeout(fill); window.clearTimeout(finish); };
  }, []);
  return <div className="modal-backdrop"><section className="dust-panel" role="dialog" aria-modal="true" aria-label={copy.dust}>
    <h2>{copy.dust}</h2>
    <div className="dust-card"><PurchaseCardFace kind={drop.kind} /></div>
    <strong className="dust-amount">+{after - before} {copy.xp}</strong>
    <ElementProgress collectionId={drop.collectionId} xp={filled ? after : before} from={before} />
  </section></div>;
}
