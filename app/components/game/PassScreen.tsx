import { useState } from "react";
import { COLLECTIONS, collectionById } from "../../game/collections";
import { canClaim, claimKey, emptyPass, PASS_REWARDS, type RewardTrack } from "../../game/element-progression";
import { useLocalization } from "../../game/localization";
import { progressionCopy } from "../../game/progression-copy";
import { ElementProgress, PassShortcuts } from "./ElementProgress";
import { BackIcon } from "./Primitives";
import type { useElementProgression } from "./hooks/useElementProgression";

type Props = { progression: ReturnType<typeof useElementProgression>; initialId?: string; onBack: () => void };

export function PassScreen({ progression, initialId, onBack }: Props) {
  const { language, t } = useLocalization();
  const copy = progressionCopy[language];
  const [id, setId] = useState(initialId ?? COLLECTIONS[0].id);
  const collection = collectionById(id);
  const pass = progression.passes[id] ?? emptyPass();
  return (
    <main className="pass-shell">
      <header className="section-screen-header"><button className="back-button" onClick={onBack} aria-label={t("back")}><BackIcon /></button><div><span>{copy.passes}</span><h1>{collection.name[language]}</h1></div></header>
      <PassShortcuts passes={progression.passes} onOpen={setId} />
      <ElementProgress collectionId={id} xp={pass.xp} />
      <p>{copy.roundRules}</p>
      {!pass.premium && <div className="pass-premium"><button className="secondary-button" disabled={progression.busy} onClick={() => void progression.activatePremium(id)}>{copy.testPremium}</button><small>{copy.testNotice}</small></div>}
      {progression.error && <p role="alert">{copy.failed}</p>}
      <div className="pass-track-head"><span>{copy.level}</span><strong>{copy.free}</strong><strong>{copy.premium}</strong></div>
      <div className="pass-levels">
        {PASS_REWARDS.map(({ level, rewards }) => <div className="pass-level" key={level}>
          <strong>{level}</strong>
          {(["free", "premium"] as RewardTrack[]).map((track) => {
            const claimed = pass.claimed.includes(claimKey(level, track));
            const ready = canClaim(pass, level, track);
            return <button className={`pass-reward ${ready ? "claimable" : ""} ${claimed ? "claimed" : ""}`} key={track} disabled={!ready || progression.busy} onClick={() => void progression.claim(id, level, track)} aria-label={`${copy[track]}, ${copy.level} ${level}, ${rewards[track][0].amount}`}>
              <strong>◈ {rewards[track][0].amount}</strong><small>{claimed ? copy.claimed : ready ? copy.claim : copy.locked}</small>
            </button>;
          })}
        </div>)}
      </div>
    </main>
  );
}
