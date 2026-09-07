import './audit-module-loader.mjs';
import assert from 'node:assert/strict';
import { importSource, writeResult } from './audit-paths.mjs';

const { cacheLocalPlayerProgress, initialLocalPlayerProgress, purchaseLocalCardPack, readLocalPlayerProgress } = await importSource('app/game/local-player-progress.ts');
const { flushProgressOperations } = await importSource('app/game/progress-sync.ts');
const { enqueueProgressOperation, readProgressOperations } = await importSource('app/game/progress-operation-queue.ts');

const entries = new Map();
const storage = {
  getItem: key => entries.get(key) ?? null,
  setItem: (key, value) => entries.set(key, value),
  removeItem: key => entries.delete(key),
};
globalThis.window = { localStorage: storage };
process.env.NEXT_PUBLIC_API_ORIGIN = 'https://audit.invalid';
let token = 'synthetic-session-a';
globalThis.__auditPlugins = {
  SecureSession: {
    getToken: async () => ({ value: token }),
    setToken: async ({ value }) => { token = value; },
    removeToken: async () => { token = null; },
  },
  GoogleAuth: { signIn: async () => ({ idToken: 'synthetic-proof' }), isAvailable: async () => ({ available: true }) },
};
let server = { ...initialLocalPlayerProgress(), accountId: 'synthetic-a', coins: 220 };
let progressGets = 0;
globalThis.fetch = async (url, options) => {
  const path = new URL(url).pathname;
  if (path === '/api/progress') {
    progressGets++;
    return Response.json({ progress: structuredClone(server) });
  }
  if (path === '/api/account/google' && options.method === 'POST') {
    server = { ...initialLocalPlayerProgress(), accountId: 'synthetic-b', coins: 700 };
    return Response.json({ progress: structuredClone(server), email: 'audit@example.test', linked: true, switched: true, sessionToken: 'synthetic-session-b' });
  }
  if (path === '/api/account/google') return Response.json({ configured: true, nonce: 'synthetic-nonce', linked: false, email: null });
  throw new Error('Unexpected synthetic request');
};
const client = await importSource('app/game/player-progress-client.ts');
const first = await client.initializePlayerProgress();
const purchase = { id: crypto.randomUUID(), type: 'purchase', collectionId: 'ice', count: 1 };
enqueueProgressOperation(storage, purchase);
const afterPurchase = await flushProgressOperations(storage, first, async () => {
  server.coins = 170;
  return { progress: structuredClone(server) };
});
const afterReconnect = await flushProgressOperations(storage, await client.initializePlayerProgress(), async () => { throw new Error('Queue must be empty'); });
assert.equal(afterPurchase.coins, 170);
assert.equal(afterReconnect.coins, 220);
assert.equal(progressGets, 1);
const connected = await client.connectGoogleAccount();
const afterSwitchReconnect = await flushProgressOperations(storage, await client.initializePlayerProgress(), async () => { throw new Error('Queue must be empty'); });
assert.equal(connected.progress.accountId, 'synthetic-b');
assert.equal(afterSwitchReconnect.accountId, 'synthetic-a');
const rejected = { id: crypto.randomUUID(), type: 'progression', input: { type: 'claim', collectionId: 'ice', level: 1, track: 'free' } };
const reward = { id: crypto.randomUUID(), type: 'reward-ad' };
enqueueProgressOperation(storage, rejected);
enqueueProgressOperation(storage, reward);
const sent = [];
for (let retry = 0; retry < 3; retry++) {
  await assert.rejects(flushProgressOperations(storage, server, async operation => {
    sent.push(operation.id);
    if (operation.id === rejected.id) throw new Error('reward-unavailable');
    return { progress: server };
  }), /reward-unavailable/);
}
assert.equal(sent.length, 3);
assert.ok(sent.every(id => id === rejected.id));
const switchedStorageAccount = storage.getItem('tttp-cloud-account');
entries.clear();
const beforeStorageFailure = initialLocalPlayerProgress();
cacheLocalPlayerProgress(storage, beforeStorageFailure);
const interruptedPurchase = { id: crypto.randomUUID(), type: 'purchase', collectionId: 'ice', count: 1 };
const purchaseResult = purchaseLocalCardPack(beforeStorageFailure, interruptedPurchase.id, 1, 'ice');
enqueueProgressOperation(storage, interruptedPurchase);
const failingStorage = {
  setItem(key, value) {
    if (key === 'tttp-local-progress-v2') throw new Error('Synthetic quota or process failure');
    storage.setItem(key, value);
  },
};
assert.throws(() => cacheLocalPlayerProgress(failingStorage, purchaseResult.progress), /Synthetic/);
assert.equal(readLocalPlayerProgress(storage).coins, 220);
assert.equal(readProgressOperations(storage).length, 1);
writeResult('client-sync-probe.json', {
  staleSnapshot: { progressGets, serverCoins: 170, afterPurchase: afterPurchase.coins, afterReconnect: afterReconnect.coins },
  accountSwitch: { connected: connected.progress.accountId, reconnect: afterSwitchReconnect.accountId, storageAccount: switchedStorageAccount },
  permanentQueueFailure: { attempts: sent.length, laterRewardSent: sent.includes(reward.id), pending: 2 },
  interruptedPersistence: { expectedCoinsAfterOperation: purchaseResult.progress.coins, restoredCoins: readLocalPlayerProgress(storage).coins, persistedOperations: readProgressOperations(storage).length },
});
