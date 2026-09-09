import { legacyDisplayXp, PASS_LEVELS } from "../game/progression-curve.ts";
import type { ElementPass, XpAward } from "../game/element-progression.ts";
import type { PlayerProgressSnapshot } from "../game/player-progress.ts";
import type { CardDrop } from "../game/card-purchase.ts";

function legacyPass(pass: ElementPass, id: string): ElementPass {
  if (pass.version !== 2) return pass;
  const xp = legacyDisplayXp(pass.xp, id);
  const claimed = new Set(pass.claimed);
  const earned = Math.floor((pass.legacyXp ?? 0) / 1000);
  for (let level = earned + 1; level <= PASS_LEVELS; level++) {
    claimed.add(`${level}:free`);
    claimed.add(`${level}:premium`);
  }
  return { xp, premium: pass.premium, claimed: [...claimed] };
}

function legacyAward(award: XpAward): XpAward {
  const before = legacyDisplayXp(award.before, award.collectionId);
  const after = legacyDisplayXp(award.after, award.collectionId);
  return { ...award, before, after, amount: after - before };
}

export function progressionResponse(body: unknown, requestedVersion: string | null): unknown {
  if (requestedVersion === "2" || !body || typeof body !== "object") return body;
  const result = body as { progress?: PlayerProgressSnapshot; progressionVersion?: number; awards?: XpAward[]; drops?: CardDrop[] };
  if (!result.progress?.passes) return body;
  const progress = { ...result.progress, passes: Object.fromEntries(Object.entries(result.progress.passes).map(([id, pass]) => [id, legacyPass(pass, id)])) };
  if (result.progressionVersion !== 2) return { ...result, progress };
  const awards = result.awards?.map(legacyAward);
  const drops = result.drops?.map(drop => {
    if (drop.xpBefore === undefined || drop.xpAfter === undefined) return drop;
    const award = legacyAward({ collectionId: drop.collectionId, amount: drop.xp, before: drop.xpBefore, after: drop.xpAfter });
    return { ...drop, xp: award.amount, xpBefore: award.before, xpAfter: award.after };
  });
  return { ...result, progress, progressionVersion: 1, ...(awards ? { awards } : {}), ...(drops ? { drops } : {}) };
}
