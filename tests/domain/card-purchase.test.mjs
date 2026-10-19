import assert from "node:assert/strict";
import test from "node:test";

import { cardPackCost, drawCollectionPack } from "../../app/game/card-purchase.ts";

test("draws collection packs with replacement and detects repeated cards within a pack", () => {
  const pack = drawCollectionPack("ice", 5, [], () => 0);
  assert.equal(pack.length, 5);
  assert.equal(pack[0].duplicate, false);
  assert.ok(pack.slice(1).every((drop) => drop.duplicate && drop.xp === 30));
  assert.ok(pack.every((drop) => drop.collectionId === "ice"));
  assert.equal(cardPackCost(5), 250);
  assert.equal(cardPackCost(Number.NaN), 0);
});
