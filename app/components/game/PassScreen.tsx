import { useState, type CSSProperties } from "react";
import { COLLECTIONS, collectionById } from "../../game/collections";
import { availableClaims, claimableRewards, claimKey, emptyPass, passLevel, PASS_LEVELS, PASS_REWARDS, PREMIUM_MILESTONES, type RewardTrack } from "../../game/element-progression";
import { useLocalization } from "../../game/localization";
import { progressionCopy } from "../../game/progression-copy";
import { ElementProgress, PassShortcuts } from "./ElementProgress";
import { BackIcon } from "./Primitives";
import type { useElementProgression } from "./hooks/useElementProgression";

type Props = { progression: ReturnType<typeof useElementProgression>; initialId?: string; onBack: () => void };
type ClaimIntent = { type: "single"; level: number; track: RewardTrack; amount: number } | { type: "all"; count: number; amount: number };

function RewardCell({ level, track }: { level: number; track: RewardTrack }) {
  const { language } = useLocalization();
  const copy = progressionCopy[language];
  const milestone = track === "premium" ? PREMIUM_MILESTONES[level as keyof typeof PREMIUM_MILESTONES] : undefined;
  return <div className="pass-reward pass-reward-placeholder" aria-label={`${copy[track]}, ${copy.level} ${level}, ${milestone ? copy[milestone] : copy.noReward}`}>
    <strong>{milestone ? copy[milestone] : "—"}</strong><small>{milestone ? copy.comingLater : copy.noReward}</small>
  </div>;
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
  const currentLevel = passLevel(pass.xp, id);
  const focusLevel = Math.min(PASS_LEVELS, currentLevel + 1);
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
          <p>{ready.length > 0 ? `${copy.legacyRewards}: ${ready.length}` : currentLevel === PASS_LEVELS ? copy.allRewardsReached : `${copy.nextLevel}: ${focusLevel}`}</p>
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
      <p className="pass-rules">{copy.rewardsPlaceholder}</p>
      <div className="pass-action-status" aria-live="polite">
        {activeClaim && <p className="pass-action-pending">{copy.claiming}</p>}
        {notice && <p className="pass-action-success">{notice}</p>}
        {progression.error && failedClaim && <p className="pass-action-error" role="alert"><span>{copy.failed}</span><button className="secondary-button" onClick={() => void runClaim(failedClaim)}>{copy.retry}</button></p>}
      </div>
      <div className="pass-track-head"><span>{copy.level}</span><strong>{copy.free}</strong><strong>{copy.premium}</strong></div>
      <div className="pass-levels">
        {PASS_REWARDS.map(({ level }) => <div className={`pass-level ${level === currentLevel ? "current" : ""}`} id={`pass-level-${id}-${level}`} key={level}>
          <strong className="pass-level-number"><span>{level}</span>{level === currentLevel && <small>{copy.current}</small>}</strong>
          {(["free", "premium"] as RewardTrack[]).map((track) => <RewardCell key={track} level={level} track={track} />)}
        </div>)}
      </div>
    </main>
  );
}
