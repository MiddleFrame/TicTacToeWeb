import { useState, type CSSProperties } from "react";
import { COLLECTIONS, collectionById } from "../../game/collections";
import { availableClaims, canClaim, claimableRewards, claimKey, emptyPass, passLevel, PASS_LEVELS, PASS_REWARDS, type ElementPass, type RewardTrack } from "../../game/element-progression";
import { useLocalization } from "../../game/localization";
import { progressionCopy } from "../../game/progression-copy";
import { ElementProgress, PassShortcuts } from "./ElementProgress";
import { BackIcon } from "./Primitives";
import type { useElementProgression } from "./hooks/useElementProgression";

type Props = { progression: ReturnType<typeof useElementProgression>; initialId?: string; onBack: () => void };
type ClaimIntent = { type: "single"; level: number; track: RewardTrack; amount: number } | { type: "all"; count: number; amount: number };

function RewardCell({ pass, level, track, amount, busy, active, claim }: { pass: ElementPass; level: number; track: RewardTrack; amount: number; busy: boolean; active: boolean; claim: () => void }) {
  const { language } = useLocalization();
  const copy = progressionCopy[language];
  const claimed = pass.claimed.includes(claimKey(level, track));
  const ready = canClaim(pass, level, track);
  const premiumLocked = track === "premium" && !pass.premium;
  const state = active ? copy.claiming : claimed ? copy.claimed : ready ? copy.claim : premiumLocked ? copy.premiumLocked : `${copy.levelRequired} ${level}`;
  return (
    <button className={`pass-reward ${ready ? "claimable" : ""} ${claimed ? "claimed" : ""} ${premiumLocked ? "premium-locked" : ""} ${active ? "claiming" : ""}`} disabled={!ready || busy} onClick={claim} aria-label={`${copy[track]}, ${copy.level} ${level}, ${amount}, ${state}`} aria-busy={active || undefined}>
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
  const [activeClaim, setActiveClaim] = useState<string | null>(null);
  const [failedClaim, setFailedClaim] = useState<ClaimIntent | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const collection = collectionById(id);
  const pass = progression.passes[id] ?? emptyPass();
  const ready = availableClaims(pass);
  const currentLevel = passLevel(pass.xp);
  const focusLevel = ready[0]?.level ?? Math.min(PASS_LEVELS, currentLevel + 1);
  const focusRewards = () => document.getElementById(`pass-level-${id}-${focusLevel}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  const runClaim = async (intent: ClaimIntent) => {
    const key = intent.type === "all" ? "all" : claimKey(intent.level, intent.track);
    setActiveClaim(key);
    setFailedClaim(null);
    setNotice(null);
    const succeeded = intent.type === "all"
      ? await progression.claimAll(id)
      : await progression.claim(id, intent.level, intent.track);
    setActiveClaim(null);
    if (!succeeded) {
      setFailedClaim(intent);
      return;
    }
    const received = intent.type === "all" ? `${copy.rewardsReceived}: ${intent.count}` : copy.rewardReceived;
    setNotice(`${received}${intent.amount > 0 ? ` · +${intent.amount} ${copy.coinsReceived}` : ""}`);
  };
  const changeCollection = (collectionId: string) => {
    setId(collectionId);
    setActiveClaim(null);
    setFailedClaim(null);
    setNotice(null);
  };
  return (
    <main className="pass-shell" style={{ "--element-color": collection.color } as CSSProperties}>
      <header className="section-screen-header"><button className="back-button" onClick={onBack} aria-label={t("back")}><BackIcon /></button><div><span>{copy.passes}</span><h1>{collection.name[language]}</h1></div></header>
      <PassShortcuts passes={progression.passes} onOpen={changeCollection} selectedId={id} />
      <section className="pass-overview" aria-label={copy.progressSummary}>
        <ElementProgress collectionId={id} xp={pass.xp} />
        <div className="pass-overview-footer">
          <p>{ready.length > 0 ? `${copy.readyCount}: ${ready.length}` : currentLevel === PASS_LEVELS ? copy.allRewardsReached : `${copy.nextReward}: ${copy.level} ${focusLevel}`}</p>
          <div className="pass-overview-actions">
            {ready.length > 0 && <button className="secondary-button pass-claim-all-button" disabled={progression.busy} onClick={() => {
              const rewards = claimableRewards(pass);
              void runClaim({ type: "all", count: rewards.keys.length, amount: rewards.coins });
            }}>{activeClaim === "all" ? copy.claiming : copy.claimAll}</button>}
            <button className="secondary-button pass-focus-button" onClick={focusRewards}>{copy.showNearest}</button>
          </div>
        </div>
      </section>
      <p className="pass-rules">{copy.roundRules}</p>
      <div className="pass-action-status" aria-live="polite">
        {activeClaim && <p className="pass-action-pending">{copy.claiming}</p>}
        {notice && <p className="pass-action-success">{notice}</p>}
        {progression.error && failedClaim && <p className="pass-action-error" role="alert"><span>{copy.failed}</span><button className="secondary-button" onClick={() => void runClaim(failedClaim)}>{copy.retry}</button></p>}
      </div>
      <div className="pass-track-head"><span>{copy.level}</span><strong>{copy.free}</strong><strong>{copy.premium}</strong></div>
      <div className="pass-levels">
        {PASS_REWARDS.map(({ level, rewards }) => <div className={`pass-level ${level === currentLevel ? "current" : ""}`} id={`pass-level-${id}-${level}`} key={level}>
          <strong className="pass-level-number"><span>{level}</span>{level === currentLevel && <small>{copy.current}</small>}</strong>
          {(["free", "premium"] as RewardTrack[]).map((track) => <RewardCell key={track} pass={pass} level={level} track={track} amount={rewards[track][0].amount} busy={progression.busy} active={activeClaim === claimKey(level, track)} claim={() => void runClaim({ type: "single", level, track, amount: rewards[track][0].amount })} />)}
        </div>)}
      </div>
    </main>
  );
}
