import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { grantRewardedAd, RewardedAdRateLimitError } from "../app/backend/rewarded-rewards.ts";
import { purchaseCollectionPack } from "../app/backend/collection-store.ts";
import { apiJson, apiOptions } from "../app/backend/responses.ts";
import { isOperationId } from "../app/game/player-progress.ts";
import { createTestDb, seedAccount } from "./helpers/sqlite-d1.mjs";

const NOW = Date.parse("2026-09-08T12:00:00.000Z");

function fixture() {
  const state = createTestDb();
  seedAccount(state.sqlite, "owner", "REWARDS001");
  const original = state.db.batch;
  let batches = Promise.resolve();
  state.db.batch = (statements) => {
    const result = batches.then(() => original(statements));
    batches = result.catch(() => undefined);
    return result;
  };
  return state;
}

function seedRewards(sqlite, count, createdAt = NOW - 1000) {
  const insert = sqlite.prepare("INSERT INTO reward_ledger (id, operation_id, user_id, currency, amount, balance_after, reason, created_at) VALUES (?, ?, 'owner', 'coins', 50, ?, 'rewarded-ad', ?)");
  for (let index = 0; index < count; index += 1) insert.run(crypto.randomUUID(), crypto.randomUUID(), 150 + index * 50, createdAt);
  sqlite.prepare("UPDATE wallets SET coins = ? WHERE user_id = 'owner'").run(100 + count * 50);
}

test("concurrent rewarded requests reserve only the remaining hourly slot", async () => {
  const { db, sqlite } = fixture();
  try {
    seedRewards(sqlite, 19);
    const results = await Promise.allSettled(Array.from({ length: 2 }, () => grantRewardedAd(db, "owner", crypto.randomUUID(), NOW)));
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    const rejected = results.find((result) => result.status === "rejected").reason;
    assert.ok(rejected instanceof RewardedAdRateLimitError);
    assert.equal(rejected.message, "reward-rate-limited");
    assert.equal(rejected.retryAfter, 3599);
    assert.equal(sqlite.prepare("SELECT coins FROM wallets WHERE user_id = 'owner'").get().coins, 1100);
    assert.equal(sqlite.prepare("SELECT count(*) AS n FROM reward_ledger").get().n, 20);
    assert.equal(sqlite.prepare("SELECT balance_after FROM reward_ledger WHERE created_at = ?").get(NOW).balance_after, 1100);
  } finally {
    sqlite.close();
  }
});

test("a concurrent rewarded burst has exact wallet and ledger balances", async () => {
  const { db, sqlite } = fixture();
  try {
    const results = await Promise.allSettled(Array.from({ length: 30 }, () => grantRewardedAd(db, "owner", crypto.randomUUID(), NOW)));
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 20);
    assert.ok(results.filter((result) => result.status === "rejected").every((result) => result.reason instanceof RewardedAdRateLimitError));
    const balances = sqlite.prepare("SELECT balance_after FROM reward_ledger ORDER BY balance_after").all().map((row) => row.balance_after);
    assert.deepEqual(balances, Array.from({ length: 20 }, (_, index) => 150 + index * 50));
    assert.equal(sqlite.prepare("SELECT coins FROM wallets WHERE user_id = 'owner'").get().coins, 1100);
  } finally {
    sqlite.close();
  }
});

test("repeated rewarded operation IDs grant once, including at the hourly limit and after expiry", async () => {
  const { db, sqlite } = fixture();
  try {
    seedRewards(sqlite, 19);
    const id = crypto.randomUUID();
    await Promise.all(Array.from({ length: 8 }, () => grantRewardedAd(db, "owner", id, NOW)));
    await grantRewardedAd(db, "owner", id, NOW + 3_600_000);
    assert.equal(sqlite.prepare("SELECT coins FROM wallets WHERE user_id = 'owner'").get().coins, 1100);
    assert.equal(sqlite.prepare("SELECT count(*) AS n FROM reward_ledger WHERE operation_id = ?").get(id).n, 1);
  } finally {
    sqlite.close();
  }
});

test("rewarded failures roll back the reservation and preserve the same ID for retry", async () => {
  const { db, sqlite } = fixture();
  try {
    const id = crypto.randomUUID();
    sqlite.exec("CREATE TRIGGER fail_wallet BEFORE UPDATE ON wallets BEGIN SELECT RAISE(ABORT, 'synthetic-wallet-failure'); END");
    await assert.rejects(grantRewardedAd(db, "owner", id, NOW), /synthetic-wallet-failure/);
    assert.equal(sqlite.prepare("SELECT count(*) AS n FROM reward_ledger").get().n, 0);
    assert.equal(sqlite.prepare("SELECT coins FROM wallets WHERE user_id = 'owner'").get().coins, 100);
    sqlite.exec("DROP TRIGGER fail_wallet");
    await grantRewardedAd(db, "owner", id, NOW);
    assert.equal(sqlite.prepare("SELECT coins FROM wallets WHERE user_id = 'owner'").get().coins, 150);
    assert.equal(sqlite.prepare("SELECT balance_after FROM reward_ledger").get().balance_after, 150);
  } finally {
    sqlite.close();
  }
});

test("the sliding hourly boundary and historical over-limit receipts produce a truthful retry time", async () => {
  const { db, sqlite } = fixture();
  try {
    seedRewards(sqlite, 21);
    const updateOldest = sqlite.prepare("UPDATE reward_ledger SET created_at = ? WHERE rowid = (SELECT rowid FROM reward_ledger ORDER BY rowid LIMIT 1 OFFSET ?)");
    updateOldest.run(NOW - 3_599_000, 0);
    updateOldest.run(NOW - 3_590_000, 1);
    await assert.rejects(grantRewardedAd(db, "owner", crypto.randomUUID(), NOW), (error) => error instanceof RewardedAdRateLimitError && error.retryAfter === 10);
    await assert.rejects(grantRewardedAd(db, "owner", crypto.randomUUID(), NOW + 1000), (error) => error instanceof RewardedAdRateLimitError && error.retryAfter === 9);
    await grantRewardedAd(db, "owner", crypto.randomUUID(), NOW + 10000);
    assert.equal(sqlite.prepare("SELECT coins FROM wallets WHERE user_id = 'owner'").get().coins, 1200);
  } finally {
    sqlite.close();
  }
});

test("wallet mutations from purchases and rewarded grants keep ledger balances consistent", async () => {
  const { db, sqlite } = fixture();
  try {
    await Promise.all([
      purchaseCollectionPack(db, "owner", crypto.randomUUID(), 1, "regular"),
      grantRewardedAd(db, "owner", crypto.randomUUID(), NOW),
    ]);
    const entries = sqlite.prepare("SELECT amount, balance_after FROM reward_ledger ORDER BY rowid").all();
    let balance = 100;
    for (const entry of entries) {
      balance += entry.amount;
      assert.equal(entry.balance_after, balance);
    }
    assert.equal(balance, 100);
    assert.equal(sqlite.prepare("SELECT coins FROM wallets WHERE user_id = 'owner'").get().coins, balance);
  } finally {
    sqlite.close();
  }
});

test("reward operation collisions cannot credit another account", async () => {
  const { db, sqlite } = fixture();
  try {
    seedAccount(sqlite, "other", "REWARDS002");
    const id = crypto.randomUUID();
    await grantRewardedAd(db, "owner", id, NOW);
    await assert.rejects(grantRewardedAd(db, "other", id, NOW), /invalid-reward/);
    assert.equal(sqlite.prepare("SELECT coins FROM wallets WHERE user_id = 'other'").get().coins, 100);
  } finally {
    sqlite.close();
  }
});

test("Android cross-origin responses expose Retry-After without changing their JSON body", async () => {
  const response = apiJson(new Request("https://audit.invalid/api/rewards/ad", { headers: { Origin: "https://localhost" } }), { error: "reward-rate-limited" }, { status: 429, headers: { "Retry-After": "3599" } });
  assert.equal(response.status, 429);
  assert.equal(response.headers.get("Access-Control-Expose-Headers"), "Retry-After");
  assert.equal(response.headers.get("Retry-After"), "3599");
  assert.deepEqual(await response.json(), { error: "reward-rate-limited" });
});

test("the rewarded HTTP route validates JSON and exposes the existing quota error with Retry-After", async () => {
  const source = readFileSync(new URL("../app/api/rewards/ad/route.ts", import.meta.url), "utf8");
  const exports = {};
  let grantCalls = 0;
  const modules = {
    "../../../backend/progress": { grantRewardedAdCoins: async () => { grantCalls += 1; throw new RewardedAdRateLimitError(17); } },
    "../../../backend/rewarded-rewards": { RewardedAdRateLimitError },
    "../../../backend/request-session": { authenticateRequest: async () => ({ account: { id: "owner" } }) },
    "../../../backend/responses": { apiJson, apiOptions },
    "../../../game/player-progress": { isOperationId },
  };
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText, {
    exports,
    require: (name) => {
      if (!(name in modules)) throw new Error(`Unexpected route import ${name}`);
      return modules[name];
    },
    Error,
  });
  const post = (body) => exports.POST(new Request("https://audit.invalid/api/rewards/ad", { method: "POST", headers: { Origin: "https://localhost" }, body }));
  for (const body of ["null", "[]", '"string"', "123", '{}', '{"operationId":"invalid"}']) {
    const response = await post(body);
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: "invalid-reward" });
  }
  assert.equal(grantCalls, 0);
  assert.deepEqual(await (await post("{")).json(), { error: "invalid-json" });
  const limited = await post(JSON.stringify({ operationId: crypto.randomUUID() }));
  assert.equal(grantCalls, 1);
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get("Retry-After"), "17");
  assert.equal(limited.headers.get("Access-Control-Expose-Headers"), "Retry-After");
  assert.deepEqual(await limited.json(), { error: "reward-rate-limited" });
});
