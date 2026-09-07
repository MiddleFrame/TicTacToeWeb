import assert from 'node:assert/strict';
import { importSource, writeResult } from './audit-paths.mjs';

const { applyProgressionAction } = await importSource('app/backend/progression-actions.ts');
const { readElementProgress } = await importSource('app/backend/element-progress.ts');
const { createTestDb, seedAccount } = await importSource('tests/helpers/sqlite-d1.mjs');
const { DECK_BUILDING_KINDS } = await importSource('app/game/cards.ts');
const { validateLibrary } = await importSource('app/game/saved-decks.ts');

const { db, sqlite } = createTestDb();
seedAccount(sqlite, 'synthetic-owner', 'SYNTHETIC01');
const { state } = await readElementProgress(db, 'synthetic-owner');
state.passes.ice.xp = 1000;
sqlite.prepare('UPDATE element_progress SET state = ? WHERE user_id = ?').run(JSON.stringify(state), 'synthetic-owner');
const operationId = crypto.randomUUID();
const original = await applyProgressionAction(db, 'synthetic-owner', operationId, { type: 'activate-test-premium', collectionId: 'ice' });
const mismatched = await applyProgressionAction(db, 'synthetic-owner', operationId, { type: 'claim', collectionId: 'ice', level: 1, track: 'free' });
const after = await readElementProgress(db, 'synthetic-owner');
assert.deepEqual(mismatched, original);
assert.deepEqual(after.state.passes.ice.claimed, []);
assert.equal(after.revision, 1);
const decks = Array.from({ length: 100 }, () => ({ id: crypto.randomUUID(), name: 'a'.repeat(30), kinds: [...DECK_BUILDING_KINDS] }));
const library = { activeId: decks[0].id, decks };
const saveRequest = { type: 'save-decks', library, operationId: crypto.randomUUID() };
const requestCharacters = JSON.stringify(saveRequest).length;
assert.equal(validateLibrary(library, DECK_BUILDING_KINDS), true);
assert.equal(requestCharacters, 33746);
assert.ok(requestCharacters > 32768);
writeResult('operation-replay-probe.json', {
  sameIdDifferentPayload: { original, mismatched, claimed: after.state.passes.ice.claimed, revision: after.revision },
  maximumDeckLibrary: { validLibrary: true, requestCharacters, routeLimit: 32768 },
});
sqlite.close();
