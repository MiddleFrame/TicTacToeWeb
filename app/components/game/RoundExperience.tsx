import { collectionById } from "../../game/collections";
import { availableClaims, emptyPass } from "../../game/element-progression";
import { useLocalization } from "../../game/localization";
import { progressionCopy } from "../../game/progression-copy";
import { ElementProgress } from "./ElementProgress";
import type { RoundProgressResult } from "./hooks/useRoundProgression";
import type { useElementProgression } from "./hooks/useElementProgression";

export function RoundExperience({ result, progression, forfeit = false, draw = false }: { result: RoundProgressResult; progression: ReturnType<typeof useElementProgression>; forfeit?: boolean; draw?: boolean }) {
  const { language } = useLocalization();
  const copy = progressionCopy[language];
  if (forfeit) return <p className="round-experience">{copy.forfeit}</p>;
  return <section className="round-experience" aria-live="polite">
    <h3>{copy.roundXp}</h3>
    {draw && <p>{copy.noXp}</p>}
    {result.pending && <p>{copy.xpPending}</p>}
    {result.failed && <p>{copy.xpUnavailable} <button className="secondary-button" onClick={result.retry}>{copy.retry}</button></p>}
    {result.awards.map((award) => {
      const pass = progression.passes[award.collectionId] ?? emptyPass();
      const claim = availableClaims(pass)[0];
      return <div key={award.collectionId}>
        <strong>{collectionById(award.collectionId).name[language]} · +{award.amount} {copy.xp}</strong>
        <ElementProgress key={`${award.collectionId}-${award.before}`} collectionId={award.collectionId} xp={award.after} from={award.before} />
        {claim && <button className="secondary-button" disabled={progression.busy} onClick={() => void progression.claim(award.collectionId, claim.level, claim.track)}>{copy.claim} · {copy.level} {claim.level}</button>}
      </div>;
    })}
    {progression.error && <p role="alert">{copy.failed}</p>}
  </section>;
}
