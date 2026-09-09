import type { D1Database } from "@cloudflare/workers-types";
import { cardPackCost, drawCollectionPack, operationRandom } from "../game/card-purchase.ts";
import { awardExperience, PROGRESSION_VERSION } from "../game/element-progression.ts";
import type { ProgressionVersion } from "../game/progression-curve.ts";
import { changeCoins, mutateElementProgress } from "./element-progress.ts";

export async function purchaseCollectionPack(db: D1Database, userId: string, operationId: string, count: number, collectionId: string, version: ProgressionVersion = PROGRESSION_VERSION) {
  return mutateElementProgress(db, userId, operationId, (context) => {
    const drops = drawCollectionPack(collectionId, count, context.unlockedKinds, operationRandom(operationId), version);
    const cost = cardPackCost(count);
    changeCoins(context, -cost, "collection-pack");
    const awards = drops.filter((drop) => drop.duplicate).map((drop) => {
      const award = awardExperience(context.state.passes, { [collectionId]: drop.xp }, version)[0];
      drop.xp = award.amount;
      drop.xpBefore = award.before;
      drop.xpAfter = award.after;
      return award;
    });
    for (const drop of drops.filter((item) => !item.duplicate)) {
      context.statements.push(db.prepare("INSERT INTO inventory (user_id, item_id, quantity, acquired_at) VALUES (?, ?, 1, ?) ON CONFLICT DO NOTHING")
        .bind(userId, drop.kind, context.now));
    }
    context.statements.push(db.prepare("INSERT INTO store_purchases (operation_id, user_id, purchased_kinds, cost, created_at) VALUES (?, ?, ?, ?, ?)")
      .bind(operationId, userId, JSON.stringify(drops.map((drop) => drop.kind)), cost, context.now));
    return { drops, awards, purchasedKinds: drops.map((drop) => drop.kind), progressionVersion: PROGRESSION_VERSION };
  });
}
