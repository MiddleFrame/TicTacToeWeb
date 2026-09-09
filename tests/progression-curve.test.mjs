import assert from "node:assert/strict";
import test from "node:test";
import { levelCost, levelProgress, levelThreshold, migrateLegacyXp, passLevel } from "../app/game/progression-curve.ts";
import { awardExperience, availableClaims, initialPasses, normalizePass, normalizePasses, PASS_REWARDS } from "../app/game/element-progression.ts";
import { applyLocalProgressionAction, cacheLocalPlayerProgress, initialLocalPlayerProgress, readLocalPlayerProgress } from "../app/game/local-player-progress.ts";
import { enqueueProgressOperation, readProgressOperations } from "../app/game/progress-operation-queue.ts";
import { flushProgressOperations } from "../app/game/progress-sync.ts";
import { applyProgressionAction } from "../app/backend/progression-actions.ts";
import { purchaseCollectionPack } from "../app/backend/collection-store.ts";
import { readElementProgress } from "../app/backend/element-progress.ts";
import { DECK_BUILDING_KINDS, STARTER_SELECTED_KINDS } from "../app/game/cards.ts";
import { createTestDb, seedAccount } from "./helpers/sqlite-d1.mjs";

function memoryStorage() {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
}

async function fixture(xp = 999) {
  const f = createTestDb();
  seedAccount(f.sqlite, "owner", "CURVEOWNER");
  f.sqlite.exec("UPDATE wallets SET coins = 200");
  for (const kind of DECK_BUILDING_KINDS) f.sqlite.prepare("INSERT INTO inventory VALUES ('owner', ?, 1, 1)").run(kind);
  const { state } = await readElementProgress(f.db, "owner");
  state.passes = { regular: { xp: 0, premium: false, claimed: [] }, ice: { xp, premium: true, claimed: [] } };
  f.sqlite.prepare("UPDATE element_progress SET state = ? WHERE user_id = 'owner'").run(JSON.stringify(state));
  let pending = Promise.resolve();
  const batch = f.db.batch;
  f.db.batch = statements => {
    const result = pending.then(() => batch(statements));
    pending = result.catch(() => undefined);
    return result;
  };
  return f;
}

test("all 100 collection thresholds, boundary levels and partial progress match the chosen curves", () => {
  for (const [id, first, step, maximum] of [["ice", 250, 20, 124000], ["regular", 550, 45, 277750]]) {
    let sum = 0;
    assert.equal(passLevel(0, id), 0);
    for (let level = 1; level <= 100; level++) {
      const cost = first + step * (level - 1);
      assert.equal(levelCost(id, level), cost);
      sum += cost;
      assert.equal(levelThreshold(id, level), sum);
      assert.equal(passLevel(sum - 1, id), level - 1);
      assert.equal(passLevel(sum, id), level);
      const progress = levelProgress(sum - 1, id);
      assert.equal(progress.current, cost - 1);
      assert.equal(progress.required, cost);
    }
    assert.equal(sum, maximum);
    assert.deepEqual(levelProgress(maximum + 1000, id), { level: 100, current: 0, required: 0, total: maximum, percent: 100 });
  }
  assert.deepEqual([40, 60, 80, 100].map(level => levelThreshold("ice", level)), [25600, 50400, 83200, 124000]);
  assert.deepEqual([40, 60, 80, 100].map(level => levelThreshold("regular", level)), [57100, 112650, 186200, 277750]);
});

test("legacy migration preserves level, premium and claims, and is idempotent across local saves", () => {
  const storage = memoryStorage();
  for (const id of ["regular", "ice"]) {
    for (const xp of [0, 1, 999, 1000, 1090, 50001, 99999, 100000]) {
      const old = { xp, premium: true, claimed: ["1:free", "2:premium"] };
      const pass = normalizePass(old, id);
      assert.equal(passLevel(pass.xp, id), Math.floor(xp / 1000));
      assert.equal(pass.legacyXp, xp);
      assert.equal(pass.premium, true);
      assert.deepEqual(pass.claimed, old.claimed);
      assert.deepEqual(normalizePass(pass, id), pass);
      const expectedFraction = (xp % 1000) / 1000;
      const nextCost = levelCost(id, Math.floor(xp / 1000) + 1);
      const progress = levelProgress(pass.xp, id);
      if (progress.required) assert.ok(Math.abs(progress.current / progress.required - expectedFraction) < 1 / nextCost + 1e-9);
      const snapshot = initialLocalPlayerProgress();
      snapshot.passes[id] = pass;
      cacheLocalPlayerProgress(storage, snapshot);
      assert.deepEqual(readLocalPlayerProgress(storage).passes[id], pass);
    }
  }
});

test("new reward placeholders cannot be claimed, including premium cosmetic milestones", async () => {
  const passes = initialPasses();
  for (const id of ["regular", "ice"]) {
    passes[id].xp = levelThreshold(id, 100);
    passes[id].premium = true;
    assert.deepEqual(availableClaims(passes[id]), []);
  }
  assert.ok(PASS_REWARDS.every(level => level.rewards.free.length === 0 && level.rewards.premium.length === 0));
  const f = await fixture(0);
  try {
    const { state } = await readElementProgress(f.db, "owner");
    state.passes = passes;
    f.sqlite.prepare("UPDATE element_progress SET state = ?").run(JSON.stringify(state));
    for (const level of [1, 40, 60, 80, 100]) {
      await assert.rejects(applyProgressionAction(f.db, "owner", crypto.randomUUID(), { type: "claim", collectionId: "ice", level, track: "premium", progressionVersion: 2 }), /reward-unavailable/);
    }
    await assert.rejects(applyProgressionAction(f.db, "owner", crypto.randomUUID(), { type: "claim-all", collectionId: "ice", progressionVersion: 2 }), /reward-unavailable/);
    assert.equal(f.sqlite.prepare("SELECT coins FROM wallets").get().coins, 200);
    assert.equal(f.sqlite.prepare("SELECT count(*) AS n FROM reward_ledger").get().n, 0);
    assert.deepEqual((await readElementProgress(f.db, "owner")).state.passes, passes);
  } finally { f.sqlite.close(); }
});

test("a cached old round, claim and purchase queue converges after migration and a lost acknowledgement", async () => {
  const f = await fixture();
  const storage = memoryStorage();
  try {
    const round = { type: "record-round", mode: "bot", kinds: [...STARTER_SELECTED_KINDS], outcome: "win" };
    const operations = [
      { id: crypto.randomUUID(), type: "progression", input: round },
      { id: crypto.randomUUID(), type: "progression", input: { type: "claim", collectionId: "ice", level: 1, track: "free" } },
      { id: crypto.randomUUID(), type: "purchase", count: 1, collectionId: "ice" },
    ];
    const cached = { ...initialLocalPlayerProgress(), accountId: "owner", coins: 160, unlockedKinds: [...DECK_BUILDING_KINDS] };
    cached.passes = { regular: { xp: 24, premium: false, claimed: [] }, ice: { xp: 1102, premium: true, claimed: ["1:free"] } };
    cacheLocalPlayerProgress(storage, cached);
    for (const op of operations) enqueueProgressOperation(storage, op);
    const restored = readLocalPlayerProgress(storage);
    const input = { ...round, progressionVersion: 2 };
    const local = applyLocalProgressionAction(restored, input).progress;
    enqueueProgressOperation(storage, { id: crypto.randomUUID(), type: "progression", input });
    let loseAck = true;
    const send = async operation => {
      if (operation.type === "purchase") await purchaseCollectionPack(f.db, "owner", operation.id, operation.count, operation.collectionId, operation.progressionVersion ?? 1);
      else await applyProgressionAction(f.db, "owner", operation.id, operation.input);
      if (loseAck && operation.id === operations[2].id) { loseAck = false; throw new Error("lost-ack"); }
      return { progress: { ...local, coins: f.sqlite.prepare("SELECT coins FROM wallets").get().coins, passes: (await readElementProgress(f.db, "owner")).state.passes } };
    };
    await assert.rejects(flushProgressOperations(storage, local, send), /lost-ack/);
    assert.equal(readProgressOperations(storage).length, 2);
    const synced = await flushProgressOperations(storage, local, send);
    assert.deepEqual(synced.passes, local.passes);
    assert.equal(synced.coins, local.coins);
    assert.equal(synced.passes.ice.xp, migrateLegacyXp(1102, "ice") + 3);
    assert.equal(synced.passes.ice.legacyXp, 1102);
    assert.equal(synced.passes.regular.xp, migrateLegacyXp(24, "regular") + 24);
    assert.equal(readProgressOperations(storage).length, 0);
    assert.equal(f.sqlite.prepare("SELECT count(*) AS n FROM progression_operations").get().n, 4);
    assert.equal(f.sqlite.prepare("SELECT count(*) AS n FROM reward_ledger").get().n, 2);
  } finally { f.sqlite.close(); }
});

test("migration remains read-only until an atomic mutation and rolls back with a failed purchase", async () => {
  const f = await fixture(50000);
  try {
    const before = f.sqlite.prepare("SELECT state, revision FROM element_progress").get();
    await readElementProgress(f.db, "owner");
    assert.deepEqual(f.sqlite.prepare("SELECT state, revision FROM element_progress").get(), before);
    f.sqlite.exec("CREATE TRIGGER deny_curve_purchase BEFORE INSERT ON store_purchases BEGIN SELECT RAISE(ABORT, 'migration-rollback'); END");
    const id = crypto.randomUUID();
    await assert.rejects(purchaseCollectionPack(f.db, "owner", id, 1, "ice", 2), /migration-rollback/);
    assert.deepEqual(f.sqlite.prepare("SELECT state, revision FROM element_progress").get(), before);
    assert.equal(f.sqlite.prepare("SELECT coins FROM wallets").get().coins, 200);
    assert.equal(f.sqlite.prepare("SELECT count(*) AS n FROM progression_operations").get().n, 0);
    f.sqlite.exec("DROP TRIGGER deny_curve_purchase");
    await purchaseCollectionPack(f.db, "owner", id, 1, "ice", 2);
    const pass = (await readElementProgress(f.db, "owner")).state.passes.ice;
    assert.equal(pass.version, 2);
    assert.equal(pass.xp, migrateLegacyXp(50000, "ice") + 30);
  } finally { f.sqlite.close(); }
});

test("concurrent old and new XP mutations preserve both coordinates and grant once", async () => {
  const f = await fixture(9000);
  try {
    const round = { type: "record-round", mode: "bot", kinds: [...STARTER_SELECTED_KINDS], outcome: "win" };
    const oldId = crypto.randomUUID(), newId = crypto.randomUUID();
    await Promise.all([
      applyProgressionAction(f.db, "owner", oldId, round),
      applyProgressionAction(f.db, "owner", newId, { ...round, progressionVersion: 2 }),
    ]);
    const current = (await readElementProgress(f.db, "owner")).state.passes;
    assert.equal(current.ice.legacyXp, 9003);
    assert.equal(current.ice.xp, migrateLegacyXp(9003, "ice") + 3);
    await applyProgressionAction(f.db, "owner", oldId, round);
    await applyProgressionAction(f.db, "owner", newId, { ...round, progressionVersion: 2 });
    assert.deepEqual((await readElementProgress(f.db, "owner")).state.passes, current);
  } finally { f.sqlite.close(); }
});

test("historical receipts replay unchanged without re-awarding or rewriting their format", async () => {
  const f = await fixture(1100);
  try {
    const id = crypto.randomUUID();
    const result = { awards: [{ collectionId: "ice", amount: 100, before: 1000, after: 1100 }] };
    const serialized = JSON.stringify(result);
    f.sqlite.prepare("INSERT INTO progression_operations VALUES ('owner', ?, 1, ?, 1)").run(id, serialized);
    const replay = await applyProgressionAction(f.db, "owner", id, { type: "record-round" });
    assert.deepEqual(replay, result);
    assert.equal(f.sqlite.prepare("SELECT result FROM progression_operations").get().result, serialized);
    assert.equal((await readElementProgress(f.db, "owner")).state.passes.ice.xp, migrateLegacyXp(1100, "ice"));
  } finally { f.sqlite.close(); }
});

test("future versions are rejected without silently clearing saved progress", () => {
  const storage = memoryStorage();
  const snapshot = initialLocalPlayerProgress();
  snapshot.passes.regular.version = 99;
  cacheLocalPlayerProgress(storage, snapshot);
  const before = storage.getItem("tttp-local-progress-v2");
  assert.throws(() => readLocalPlayerProgress(storage), /unsupported-progression-version/);
  assert.equal(storage.getItem("tttp-local-progress-v2"), before);
  assert.throws(() => normalizePasses(snapshot.passes), /unsupported-progression-version/);
  const passes = initialPasses();
  passes.regular.xp = 277745;
  assert.equal(awardExperience(passes, { regular: 30 })[0].amount, 5);
  assert.deepEqual(availableClaims(passes.regular), []);
});
