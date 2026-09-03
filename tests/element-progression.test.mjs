import assert from "node:assert/strict";
import test from "node:test";
import { CARD_COUNTS, DECK_BUILDING_KINDS, STARTER_SELECTED_KINDS } from "../app/game/cards.ts";
import { CARD_COLLECTION, COLLECTIONS, collectionCards, compatibleDeck, compatibleElements } from "../app/game/collections.ts";
import { drawCollectionPack } from "../app/game/card-purchase.ts";
import { availableClaims, awardExperience, canClaim, emptyPass, initialPasses, PASS_REWARDS, passLevel, roundExperience } from "../app/game/element-progression.ts";
import { initialDeckLibrary, validateLibrary } from "../app/game/saved-decks.ts";
import { validRoundCards } from "../app/game/round-progression.ts";
import { purchaseCollectionPack } from "../app/backend/collection-store.ts";
import { applyProgressionAction } from "../app/backend/progression-actions.ts";
import { readElementProgress } from "../app/backend/element-progress.ts";
import { createTestDb, seedAccount } from "./helpers/sqlite-d1.mjs";

function fixture(coins = 2000) {
  const state = createTestDb();
  seedAccount(state.sqlite, "owner", "ELEMENTS01");
  state.sqlite.prepare("UPDATE wallets SET coins = ? WHERE user_id = 'owner'").run(coins);
  state.sqlite.prepare("INSERT INTO player_progress (user_id, selected_kinds, created_at, updated_at) VALUES ('owner', ?, 1, 1)").run(JSON.stringify(STARTER_SELECTED_KINDS));
  let batches = Promise.resolve();
  const original = state.db.batch;
  state.db.batch = (statements) => {
    const next = batches.then(() => original(statements));
    batches = next.catch(() => undefined);
    return next;
  };
  return state;
}

async function setPass(db, sqlite, id, xp, premium = false) {
  const { state } = await readElementProgress(db, "owner");
  state.passes[id] = { xp, premium, claimed: [] };
  sqlite.prepare("UPDATE element_progress SET state = ? WHERE user_id = 'owner'").run(JSON.stringify(state));
}

const action = (db, input, id = crypto.randomUUID()) => applyProgressionAction(db, "owner", id, input);

test("each card belongs to exactly one configured banner and neutral cards combine with ice", () => {
  assert.deepEqual(Object.keys(CARD_COLLECTION).sort(), [...DECK_BUILDING_KINDS].sort());
  const pools = COLLECTIONS.flatMap(({ id }) => collectionCards(id));
  assert.equal(new Set(pools).size, DECK_BUILDING_KINDS.length);
  assert.equal(compatibleDeck(STARTER_SELECTED_KINDS), true);
  assert.equal(compatibleElements(["ice", "fire"]), false);
  assert.equal(compatibleElements(["ice", "fire"], { maxElements: 1, allowedCombinations: [["ice", "fire"]] }), true);
  assert.equal(compatibleElements(["ice", "fire", "earth"], { maxElements: 1, allowedCombinations: [["ice", "fire"]] }), false);
});

test("draws include owned starter cards and duplicates within a five-card purchase", () => {
  const drops = drawCollectionPack("regular", 5, ["place"], () => 0);
  assert.ok(drops.every((drop) => drop.duplicate && drop.xp === 100 && drop.kind === "place"));
  assert.throws(() => drawCollectionPack("fire", 1, []), /unknown-collection/);
  for (const count of [0, 2, 6, NaN, Infinity]) assert.throws(() => drawCollectionPack("regular", count, []));
});

test("experience counts actual copies, separates paths, handles defeat and caps at level 100", () => {
  const cards = validRoundCards("bot", [...STARTER_SELECTED_KINDS], STARTER_SELECTED_KINDS);
  assert.equal(cards.length, 9);
  assert.deepEqual(roundExperience(cards, "win"), { regular: 24, ice: 3 });
  assert.deepEqual(roundExperience(cards, "loss"), { regular: 8, ice: 1 });
  assert.deepEqual(roundExperience(cards, "draw"), { regular: 0, ice: 0 });
  const exact = validRoundCards("roguelike", ["place", "place", "freeze-3"], []);
  assert.deepEqual(roundExperience(exact, "win"), { regular: 6, ice: 3 });
  const passes = initialPasses();
  passes.ice.xp = 99950;
  assert.equal(awardExperience(passes, { ice: 100 })[0].amount, 50);
  assert.equal(passLevel(passes.ice.xp), 100);
  assert.equal(awardExperience(passes, { ice: 100 })[0].amount, 0);
  assert.equal(PASS_REWARDS.length, 100);
  assert.equal(CARD_COUNTS.place, 5);
});

test("premium rewards stay locked, become retroactively available, and claims stay unique", () => {
  const pass = { ...emptyPass(), xp: 2000 };
  assert.equal(availableClaims(pass).length, 2);
  assert.equal(canClaim(pass, 1, "premium"), false);
  pass.premium = true;
  assert.equal(availableClaims(pass).length, 4);
  pass.claimed.push("1:premium");
  assert.equal(canClaim(pass, 1, "premium"), false);
  assert.equal(canClaim(pass, 3, "free"), false);
  assert.equal(canClaim(pass, 0, "free"), false);
  assert.equal(canClaim(pass, 1.5, "free"), false);
});

test("deck libraries reject missing active decks, repeated IDs, locked cards and bad sizes", () => {
  const library = initialDeckLibrary();
  assert.equal(validateLibrary(library, STARTER_SELECTED_KINDS), true);
  assert.equal(validateLibrary({ ...library, activeId: "missing" }, STARTER_SELECTED_KINDS), false);
  assert.equal(validateLibrary({ ...library, decks: [...library.decks, library.decks[0]] }, STARTER_SELECTED_KINDS), false);
  assert.equal(validateLibrary({ ...library, decks: [{ ...library.decks[0], kinds: ["place"] }] }, STARTER_SELECTED_KINDS), false);
  assert.equal(validateLibrary({ ...library, decks: [{ ...library.decks[0], kinds: [...STARTER_SELECTED_KINDS, "shortage"] }] }, STARTER_SELECTED_KINDS), false);
});

test("cloud migration preserves the existing selected deck and starts both passes at zero", async () => {
  const { db, sqlite } = fixture();
  const { state } = await readElementProgress(db, "owner");
  assert.deepEqual(state.deckLibrary.decks[0].kinds, STARTER_SELECTED_KINDS);
  assert.deepEqual(state.passes, initialPasses());
  sqlite.close();
});

test("completed collection remains purchasable; dust, inventory and coins commit once", async () => {
  const { db, sqlite } = fixture();
  for (const kind of collectionCards("ice")) sqlite.prepare("INSERT INTO inventory VALUES ('owner', ?, 1, 1)").run(kind);
  const operationId = crypto.randomUUID();
  const first = await purchaseCollectionPack(db, "owner", operationId, 5, "ice");
  assert.ok(first.drops.every((drop) => drop.duplicate));
  assert.deepEqual(first.drops.map((drop) => drop.xpAfter), [100, 200, 300, 400, 500]);
  assert.deepEqual(await purchaseCollectionPack(db, "owner", operationId, 5, "ice"), first);
  assert.equal((await readElementProgress(db, "owner")).state.passes.ice.xp, 500);
  assert.equal(sqlite.prepare("SELECT coins FROM wallets").get().coins, 1750);
  assert.equal(sqlite.prepare("SELECT count(*) AS n FROM reward_ledger").get().n, 1);
  assert.deepEqual(JSON.parse(sqlite.prepare("SELECT selected_kinds FROM player_progress").get().selected_kinds), STARTER_SELECTED_KINDS);
  sqlite.close();
});

test("insufficient balance and transaction failures cannot leave free cards or XP", async () => {
  const { db, sqlite } = fixture(20);
  await assert.rejects(purchaseCollectionPack(db, "owner", crypto.randomUUID(), 1, "regular"), /insufficient-coins/);
  assert.equal(sqlite.prepare("SELECT count(*) AS n FROM store_purchases").get().n, 0);
  sqlite.prepare("UPDATE wallets SET coins = 500").run();
  sqlite.exec("CREATE TRIGGER prevent_test_purchase BEFORE INSERT ON store_purchases BEGIN SELECT RAISE(ABORT, 'test-failure'); END");
  await assert.rejects(purchaseCollectionPack(db, "owner", crypto.randomUUID(), 5, "regular"), /test-failure/);
  assert.equal(sqlite.prepare("SELECT coins FROM wallets").get().coins, 500);
  assert.equal(sqlite.prepare("SELECT count(*) AS n FROM inventory").get().n, 0);
  assert.equal(sqlite.prepare("SELECT count(*) AS n FROM progression_operations").get().n, 0);
  assert.equal((await readElementProgress(db, "owner")).state.passes.regular.xp, 0);
  sqlite.close();
});

test("concurrent purchases cannot overspend a wallet", async () => {
  const { db, sqlite } = fixture(50);
  const results = await Promise.allSettled(Array.from({ length: 2 }, () => purchaseCollectionPack(db, "owner", crypto.randomUUID(), 1, "ice")));
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(sqlite.prepare("SELECT coins FROM wallets").get().coins, 0);
  assert.equal(sqlite.prepare("SELECT count(*) AS n FROM store_purchases").get().n, 1);
  sqlite.close();
});

test("concurrent claims of the same tier grant currency once, including requests with different IDs", async () => {
  const { db, sqlite } = fixture();
  await setPass(db, sqlite, "ice", 1000);
  const input = { type: "claim", collectionId: "ice", level: 1, track: "free" };
  const results = await Promise.allSettled([action(db, input), action(db, input)]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(sqlite.prepare("SELECT coins FROM wallets").get().coins, 2010);
  assert.deepEqual((await readElementProgress(db, "owner")).state.passes.ice.claimed, ["1:free"]);
  sqlite.close();
});

test("premium is separate for each collection and activates earlier unlocked rewards", async () => {
  const { db, sqlite } = fixture();
  await setPass(db, sqlite, "ice", 1000);
  const claim = { type: "claim", collectionId: "ice", level: 1, track: "premium" };
  await assert.rejects(action(db, claim), /reward-unavailable/);
  await action(db, { type: "activate-test-premium", collectionId: "ice" });
  const id = crypto.randomUUID();
  await action(db, claim, id);
  await action(db, claim, id);
  assert.equal(sqlite.prepare("SELECT coins FROM wallets").get().coins, 2025);
  assert.equal((await readElementProgress(db, "owner")).state.passes.regular.premium, false);
  sqlite.close();
});

test("round retries grant once and multiple deck saves preserve each selection", async () => {
  const { db, sqlite } = fixture();
  const id = crypto.randomUUID();
  const round = { type: "record-round", mode: "bot", kinds: [...STARTER_SELECTED_KINDS], outcome: "win" };
  await action(db, round, id);
  await action(db, round, id);
  assert.equal((await readElementProgress(db, "owner")).state.passes.regular.xp, 24);
  const library = initialDeckLibrary();
  library.decks.push({ id: "second", name: "Лёд", kinds: [...STARTER_SELECTED_KINDS] });
  library.activeId = "second";
  await action(db, { type: "save-decks", library });
  assert.deepEqual((await readElementProgress(db, "owner")).state.deckLibrary, library);
  await assert.rejects(action(db, { ...round, kinds: ["place"] }), /invalid-round-deck/);
  await assert.rejects(action(db, { ...round, outcome: "win", xp: 9999, kinds: ["fire"] }), /invalid-round-deck/);
  sqlite.close();
});

test("account deletion cascades to passes, decks and operation receipts", async () => {
  const { db, sqlite } = fixture();
  await action(db, { type: "activate-test-premium", collectionId: "ice" });
  sqlite.prepare("DELETE FROM users WHERE id = 'owner'").run();
  for (const table of ["element_progress", "progression_operations"]) assert.equal(sqlite.prepare(`SELECT count(*) AS n FROM ${table}`).get().n, 0);
  sqlite.close();
});
