import './audit-module-loader.mjs';
import assert from 'node:assert/strict';
import { importSource, writeResult } from './audit-paths.mjs';

const { createTestDb, seedAccount } = await importSource('tests/helpers/sqlite-d1.mjs');

const { sqlite } = createTestDb();
const queries = [];
const db = {
  prepare(sql) {
    let values = [];
    const wrapper = {
      bind(...input) { values = input; return wrapper; },
      async first() { queries.push(sql); return sqlite.prepare(sql).get(...values) ?? null; },
      async all() { queries.push(sql); return { results: sqlite.prepare(sql).all(...values), success: true }; },
      async raw() { queries.push(sql); const statement = sqlite.prepare(sql); statement.setReturnArrays(true); return statement.all(...values); },
      async run() { queries.push(sql); return { results: [], success: true, meta: sqlite.prepare(sql).run(...values) }; },
    };
    return wrapper;
  },
};
let batches = Promise.resolve();
db.batch = statements => {
  const result = batches.then(async () => {
    sqlite.exec('BEGIN');
    try {
      const results = [];
      for (const statement of statements) results.push(await statement.all());
      sqlite.exec('COMMIT');
      return results;
    } catch (error) {
      sqlite.exec('ROLLBACK');
      throw error;
    }
  });
  batches = result.catch(() => {});
  return result;
};
globalThis.__auditEnv = { DB: db };
const backend = await importSource('app/backend/progress.ts');
const now = new Date('2026-09-07T12:00:00Z');
seedAccount(sqlite, 'synthetic-owner', 'SYNTHETIC01');
await backend.getPlayerProgress('synthetic-owner', now);
queries.length = 0;
await backend.getPlayerProgress('synthetic-owner', now);
const snapshotQueries = queries.length;
const snapshotDml = queries.filter(query => /^(insert|update|delete)/i.test(query)).length;
sqlite.prepare('UPDATE wallets SET coins = 1050 WHERE user_id = ?').run('synthetic-owner');
const insert = sqlite.prepare("INSERT INTO reward_ledger (id, operation_id, user_id, currency, amount, balance_after, reason, created_at) VALUES (?, ?, 'synthetic-owner', 'coins', 50, ?, 'rewarded-ad', ?)");
for (let index = 0; index < 19; index++) insert.run(`synthetic-existing-${index}`, `synthetic-op-${index}`, 150 + index * 50, now.getTime());
queries.length = 0;
const operationIds = ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222'];
const results = await Promise.allSettled([
  backend.grantRewardedAdCoins('synthetic-owner', operationIds[0], now),
  backend.grantRewardedAdCoins('synthetic-owner', operationIds[1], now),
]);
const wallet = sqlite.prepare('SELECT coins FROM wallets WHERE user_id = ?').get('synthetic-owner').coins;
const count = sqlite.prepare("SELECT count(*) AS n FROM reward_ledger WHERE user_id = ? AND reason = 'rewarded-ad'").get('synthetic-owner').n;
const balances = sqlite.prepare("SELECT balance_after FROM reward_ledger WHERE operation_id IN (?, ?) ORDER BY operation_id").all(...operationIds).map(row => row.balance_after);
assert.equal(results.filter(result => result.status === 'fulfilled').length, 2);
assert.equal(count, 21);
assert.equal(wallet, 1150);
assert.deepEqual(balances, [1100, 1100]);
const adQueries = queries.length;
const repeated = await Promise.allSettled([
  backend.grantRewardedAdCoins('synthetic-owner', operationIds[0], now),
  backend.grantRewardedAdCoins('synthetic-owner', operationIds[0], now),
]);
assert.ok(repeated.every(result => result.status === 'fulfilled'));
assert.equal(sqlite.prepare('SELECT coins FROM wallets WHERE user_id = ?').get('synthetic-owner').coins, 1150);
writeResult('backend-reward-probe.json', {
  readSnapshot: { statements: snapshotQueries, insertAttempts: snapshotDml },
  concurrentAds: { initialGrants: 19, fulfilled: results.filter(result => result.status === 'fulfilled').length, finalGrants: count, wallet, newLedgerBalances: balances, statements: adQueries },
  duplicateReplay: { fulfilled: repeated.length, walletUnchanged: true },
});
sqlite.close();
