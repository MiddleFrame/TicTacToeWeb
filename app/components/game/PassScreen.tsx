import { useState, type CSSProperties } from "react";
import { COLLECTIONS, collectionById } from "../../game/collections";
import { availableClaims, canClaim, claimKey, emptyPass, passLevel, PASS_LEVELS, PASS_REWARDS, type ElementPass, type RewardTrack } from "../../game/element-progression";
import { useLocalization } from "../../game/localization";
import { progressionCopy } from "../../game/progression-copy";
import { ElementProgress, PassShortcuts } from "./ElementProgress";
import { BackIcon } from "./Primitives";
import type { useElementProgression } from "./hooks/useElementProgression";

type Props = { progression: ReturnType<typeof useElementProgression>; initialId?: string; onBack: () => void };

function RewardCell({ pass, level, track, amount, busy, claim }: { pass: ElementPass; level: number; track: RewardTrack; amount: number; busy: boolean; claim: () => void }) {
  const { language } = useLocalization();
  const copy = progressionCopy[language];
  const claimed = pass.claimed.includes(claimKey(level, track));
  const ready = canClaim(pass, level, track);
  const premiumLocked = track === "premium" && !pass.premium;
  const state = claimed ? copy.claimed : ready ? copy.claim : premiumLocked ? copy.premiumLocked : `${copy.levelRequired} ${level}`;
  return (
    <button className={`pass-reward ${ready ? "claimable" : ""} ${claimed ? "claimed" : ""} ${premiumLocked ? "premium-locked" : ""}`} disabled={!ready || busy} onClick={claim} aria-label={`${copy[track]}, ${copy.level} ${level}, ${amount}, ${state}`}>
      <span className="pass-reward-currency" aria-hidden="true">◈</span>
      <strong>{amount}</strong>
      <small>{state}</small>
    </button>
  );
}

export function PassScreen({ progression, initialId, onBack }: Props) {
  const { language, t } = useLocalization();
  const copy = progressionCopy[language];
  const [id, setId] = useState(initialId ?? COLLECTIONS[0].id);
  const collection = collectionById(id);
  const pass = progression.passes[id] ?? emptyPass();
  const ready = availableClaims(pass);
  const currentLevel = passLevel(pass.xp);
  const focusLevel = ready[0]?.level ?? Math.min(PASS_LEVELS, currentLevel + 1);
  const focusRewards = () => document.getElementById(`pass-level-${id}-${focusLevel}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  return (
    <main className="pass-shell" style={{ "--element-color": collection.color } as CSSProperties}>
      <header className="section-screen-header"><button className="back-button" onClick={onBack} aria-label={t("back")}><BackIcon /></button><div><span>{copy.passes}</span><h1>{collection.name[language]}</h1></div></header>
      <PassShortcuts passes={progression.passes} onOpen={setId} selectedId={id} />
      <section className="pass-overview" aria-label={copy.progressSummary}>
        <ElementProgress collectionId={id} xp={pass.xp} />
        <div className="pass-overview-footer">
          <p>{ready.length > 0 ? `${copy.readyCount}: ${ready.length}` : currentLevel === PASS_LEVELS ? copy.allRewardsReached : `${copy.nextReward}: ${copy.level} ${focusLevel}`}</p>
          <div className="pass-overview-actions">
            {ready.length > 0 && <button className="secondary-button pass-claim-all-button" disabled={progression.busy} onClick={() => void progression.claimAll(id)}>{copy.claimAll}</button>}
            <button className="secondary-button pass-focus-button" onClick={focusRewards}>{copy.showNearest}</button>
          </div>
        </div>
      </section>
      <p className="pass-rules">{copy.roundRules}</p>
      {progression.error && <p role="alert">{copy.failed}</p>}
      <div className="pass-track-head"><span>{copy.level}</span><strong>{copy.free}</strong><strong>{copy.premium}</strong></div>
      <div className="pass-levels">
        {PASS_REWARDS.map(({ level, rewards }) => <div className={`pass-level ${level === currentLevel ? "current" : ""}`} id={`pass-level-${id}-${level}`} key={level}>
          <strong className="pass-level-number"><span>{level}</span>{level === currentLevel && <small>{copy.current}</small>}</strong>
          {(["free", "premium"] as RewardTrack[]).map((track) => <RewardCell key={track} pass={pass} level={level} track={track} amount={rewards[track][0].amount} busy={progression.busy} claim={() => void progression.claim(id, level, track)} />)}
        </div>)}
      </div>
    </main>
  );
}
