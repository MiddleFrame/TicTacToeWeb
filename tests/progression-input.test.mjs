import assert from "node:assert/strict";
import test from "node:test";
import { MAX_PROGRESSION_REQUEST_LENGTH, parseProgressionInput } from "../app/backend/progression-input.ts";
import { applyProgressionAction } from "../app/backend/progression-actions.ts";
import { readElementProgress } from "../app/backend/element-progress.ts";
import { DECK_BUILDING_KINDS, STARTER_SELECTED_KINDS } from "../app/game/cards.ts";
import { validateLibrary } from "../app/game/saved-decks.ts";
import { createTestDb, seedAccount } from "./helpers/sqlite-d1.mjs";

function maximumLibrary(escaped) {
  const decks = Array.from({ length: 100 }, (_, index) => ({
    id: escaped ? String(index).padStart(64, "\u0000") : crypto.randomUUID(),
    name: escaped ? "\u0000".repeat(30) : "a".repeat(30),
    kinds: [...DECK_BUILDING_KINDS],
  }));
  return { activeId: decks[0].id, decks };
}

test("all 100 fully populated decks fit the progression request and persist atomically", async () => {
  for (const escaped of [false, true]) {
    const { db, sqlite } = createTestDb();
    try {
      const userId = crypto.randomUUID();
      seedAccount(sqlite, userId, "PAYLOAD001");
      sqlite.prepare("INSERT INTO player_progress (user_id, selected_kinds, created_at, updated_at) VALUES (?, ?, 1, 1)").run(userId, JSON.stringify(STARTER_SELECTED_KINDS));
      for (const kind of DECK_BUILDING_KINDS) sqlite.prepare("INSERT INTO inventory (user_id, item_id, quantity, acquired_at) VALUES (?, ?, 1, 1)").run(userId, kind);
      const library = maximumLibrary(escaped);
      assert.equal(validateLibrary(library, DECK_BUILDING_KINDS), true);
      const body = JSON.stringify({ type: "save-decks", accountId: userId, operationId: crypto.randomUUID(), library });
      assert.ok(body.length > 32768);
      assert.ok(body.length < MAX_PROGRESSION_REQUEST_LENGTH);
      const input = parseProgressionInput(body);
      await applyProgressionAction(db, userId, input.operationId, input);
      assert.deepEqual((await readElementProgress(db, userId)).state.deckLibrary, library);
      assert.deepEqual(JSON.parse(sqlite.prepare("SELECT selected_kinds FROM player_progress WHERE user_id = ?").get(userId).selected_kinds), DECK_BUILDING_KINDS);
      assert.equal(sqlite.prepare("SELECT count(*) AS n FROM progression_operations").get().n, 1);
    } finally {
      sqlite.close();
    }
  }
});

test("progression parsing keeps a bounded body and validates operation IDs", () => {
  const body = JSON.stringify({ type: "claim-all", collectionId: "ice", operationId: crypto.randomUUID() });
  const padded = body.padEnd(MAX_PROGRESSION_REQUEST_LENGTH, " ");
  assert.deepEqual(parseProgressionInput(padded), JSON.parse(body));
  assert.throws(() => parseProgressionInput(padded + " "), /input-too-large/);
  assert.throws(() => parseProgressionInput("null"), /invalid-operation/);
  assert.throws(() => parseProgressionInput('{"operationId":"bad"}'), /invalid-operation/);
  assert.throws(() => parseProgressionInput("{"), SyntaxError);
});
