import { useEffect, useState, type CSSProperties } from "react";
import { collectionById, COLLECTIONS } from "../../game/collections";
import { availableClaims, emptyPass, passLevel, PASS_LEVELS, XP_PER_LEVEL, type ElementPasses } from "../../game/element-progression";
import { useLocalization } from "../../game/localization";
import { progressionCopy } from "../../game/progression-copy";
import { Image } from "./Image";

export function ElementProgress({ collectionId, xp, from = xp, compact = false }: { collectionId: string; xp: number; from?: number; compact?: boolean }) {
  const { language } = useLocalization();
  const copy = progressionCopy[language];
  const [shown, setShown] = useState(from);
  useEffect(() => {
    const duration = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 950;
    const started = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const fraction = duration === 0 ? 1 : Math.min(1, (now - started) / duration);
      setShown(Math.round(from + (xp - from) * fraction));
      if (fraction < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [from, xp]);
  const level = passLevel(shown);
  const current = shown - level * XP_PER_LEVEL;
  const percent = level === PASS_LEVELS ? 100 : current / XP_PER_LEVEL * 100;
  return (
    <div className={`element-progress${compact ? " element-progress-compact" : ""}`} style={{ "--element-color": collectionById(collectionId).color } as CSSProperties}>
      <div><strong>{compact ? `lvl ${level}` : `${copy.level} ${level} / ${PASS_LEVELS}`}</strong>{!compact && <small>{level === PASS_LEVELS ? copy.maxLevel : `${current} / ${XP_PER_LEVEL}`}</small>}</div>
      <div className="element-progress-track" role="progressbar" aria-label={`${collectionById(collectionId).name[language]}: ${copy.level} ${level}`} aria-valuenow={shown} aria-valuemin={0} aria-valuemax={PASS_LEVELS * XP_PER_LEVEL}>
        <span style={{ width: `${percent}%`, transition: from === xp ? undefined : "none" }} />
      </div>
    </div>
  );
}

export function PassShortcuts({ passes, onOpen, selectedId }: { passes: ElementPasses; onOpen: (id: string) => void; selectedId?: string }) {
  const { language } = useLocalization();
  const copy = progressionCopy[language];
  return (
    <nav className="pass-shortcuts" aria-label={copy.passes}>
      {COLLECTIONS.map((collection) => {
        const pass = passes[collection.id] ?? emptyPass();
        const ready = availableClaims(pass).length;
        const label = `${collection.name[language]}: ${copy.level} ${passLevel(pass.xp)}${ready > 0 ? `, ${copy.rewardReady}` : ""}`;
        return <button className={selectedId === collection.id ? "selected" : ""} key={collection.id} aria-label={label} aria-current={selectedId === collection.id ? "page" : undefined} title={label} onClick={() => onOpen(collection.id)}>
          <Image className="pass-shortcut-icon" src={collection.image} alt="" width="32" height="32" unoptimized />
          {ready > 0 && <span className="pass-shortcut-dot" aria-hidden="true" />}
          <ElementProgress collectionId={collection.id} xp={pass.xp} compact />
        </button>;
      })}
    </nav>
  );
}
