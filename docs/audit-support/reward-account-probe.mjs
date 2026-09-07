import assert from 'node:assert/strict';
import { importSource, readSource, writeResult } from './audit-paths.mjs';
import vm from 'node:vm';
import ts from 'typescript';
const localProgress = await importSource('app/game/local-player-progress.ts');
const queue = await importSource('app/game/progress-operation-queue.ts');
const cards = await importSource('app/game/cards.ts');
const collections = await importSource('app/game/collections.ts');
const sync = await importSource('app/game/progress-sync.ts');
const { adoptCloudAccount } = await importSource('app/game/account-cache.ts');

const transpile = (file) => ts.transpileModule(readSource(file), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;
const deferred = () => {
  let resolve;
  const promise = new Promise((resolver) => { resolve = resolver; });
  return { promise, resolve };
};
function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, String(value)); },
    removeItem: (key) => { values.delete(key); },
  };
}
function hookHarness(stateFixture = (initial) => initial) {
  const cleanups = [];
  const effects = [];
  let stateIndex = 0;
  let stateWrites = 0;
  const react = {
    useCallback: (callback) => callback,
    useRef: (initial) => ({ current: initial }),
    useState: (initial) => {
      const value = stateFixture(typeof initial === 'function' ? initial() : initial, stateIndex++);
      return [value, () => { stateWrites += 1; }];
    },
    useEffect: (effect) => effects.push(effect),
  };
  return {
    react,
    runEffect: (index) => { const cleanup = effects[index](); if (cleanup) cleanups.push(cleanup); },
    runEffects: () => effects.forEach((effect) => { const cleanup = effect(); if (cleanup) cleanups.push(cleanup); }),
    unmount: () => cleanups.forEach((cleanup) => cleanup()),
    writes: () => stateWrites,
  };
}

const storage = memoryStorage();
const accountA = { ...localProgress.initialLocalPlayerProgress(), accountId: 'synthetic-account-a' };
const accountB = { ...localProgress.initialLocalPlayerProgress(), accountId: 'synthetic-account-b', coins: 1000 };
localProgress.cacheLocalPlayerProgress(storage, accountA);
adoptCloudAccount(storage, accountA.accountId);
const google = deferred();
const googleStarted = deferred();
const pendingPurchaseSend = deferred();
let purchaseSendCalls = 0;
const collectionHarness = hookHarness((initial, index) => index === 9 ? true : initial);
const collectionExports = {};
vm.runInNewContext(transpile('app/components/game/hooks/usePlayerCollection.ts'), {
  exports: collectionExports,
  crypto,
  window: { localStorage: storage },
  require: (id) => {
    if (id === 'react') return collectionHarness.react;
    if (id.endsWith('/collections')) return collections;
    if (id.endsWith('/cards')) return cards;
    if (id.endsWith('/local-player-progress')) return { ...localProgress, initialLocalPlayerProgress: () => structuredClone(accountA) };
    if (id.endsWith('/progress-operation-queue')) return queue;
    if (id.endsWith('/progress-sync')) return sync;
    if (id.endsWith('/player-progress-client')) return {
      initializePlayerProgress: async () => structuredClone(accountA),
      getGoogleAccountState: async () => ({ available: true, linked: false, email: null }),
      sendCloudProgressOperation: () => { purchaseSendCalls += 1; return pendingPurchaseSend.promise; },
      connectGoogleAccount: async () => {
        googleStarted.resolve();
        const response = await google.promise;
        adoptCloudAccount(storage, response.progress.accountId);
        return response;
      },
    };
    if (id.endsWith('/useElementProgression')) return { useElementProgression: () => ({ sync() {}, deckLibrary: accountA.deckLibrary }) };
    throw new Error(`Unexpected import: ${id}`);
  },
});
const collection = collectionExports.usePlayerCollection(() => {});
collectionHarness.runEffect(1);
const switching = collection.connectGoogle();
await googleStarted.promise;
assert.equal(localProgress.readLocalPlayerProgress(storage).accountId, accountA.accountId);
await collection.buyCards(1, 'regular');
await Promise.resolve();
const purchasedWhileSwitchPending = localProgress.readLocalPlayerProgress(storage);
const operationsBeforeSwitchResolved = queue.readProgressOperations(storage).length;
assert.equal(purchasedWhileSwitchPending.coins, 170);
assert.equal(operationsBeforeSwitchResolved, 1);

const ad = deferred();
let rewardCallbacks = 0;
let removedListeners = 0;
const loadedStatus = { privacyConfigured: true, initialized: true, loaded: true, loading: false };
const adHarness = hookHarness((initial, index) => index === 0 ? loadedStatus : initial);
const adExports = {};
vm.runInNewContext(transpile('app/components/game/hooks/useRewardedAd.ts'), {
  exports: adExports,
  require: (id) => {
    if (id === 'react') return adHarness.react;
    if (id === '@capacitor/core') return {
      Capacitor: { getPlatform: () => 'android' },
      registerPlugin: () => ({
        getStatus: async () => loadedStatus,
        addListener: async () => ({ remove: async () => { removedListeners += 1; } }),
        showRewarded: () => ad.promise,
      }),
    };
    throw new Error(`Unexpected import: ${id}`);
  },
});
const rewarded = adExports.useRewardedAd(() => { rewardCallbacks += 1; void collection.creditCoins(50); });
adHarness.runEffects();
rewarded.show();
google.resolve({ progress: structuredClone(accountB), email: null, linked: true, switched: true });
await switching;
const operationsAfterSwitchResolved = queue.readProgressOperations(storage).length;
adHarness.unmount();
const writesAtUnmount = adHarness.writes();
ad.resolve({ rewarded: true });
ad.resolve({ rewarded: true });
await Promise.resolve();
await Promise.resolve();
const resulting = localProgress.readLocalPlayerProgress(storage);
const queued = queue.readProgressOperations(storage);
assert.equal(resulting.accountId, accountB.accountId);
assert.equal(resulting.coins, 1050);
assert.equal(rewardCallbacks, 1);
assert.equal(queued.length, 1);
writeResult('reward-account-probe.json', {
  rewardedAttemptStartedFor: accountA.accountId,
  purchaseLocalCoinsWhileGooglePending: purchasedWhileSwitchPending.coins,
  unacknowledgedPurchaseSendCalls: purchaseSendCalls,
  queueBeforeGoogleResolved: operationsBeforeSwitchResolved,
  queueAfterGoogleResolved: operationsAfterSwitchResolved,
  callbackAfterStoreUnmount: true,
  resultCreditedTo: resulting.accountId,
  resultCoins: resulting.coins,
  rewardCallbacksAfterDuplicatePromiseResolve: rewardCallbacks,
  queuedRewardOperations: queued.length,
  operationCarriesAccountId: Object.hasOwn(queued[0], 'accountId'),
  nativeStateListenersRemoved: removedListeners,
  adStateWritesAfterUnmount: adHarness.writes() - writesAtUnmount,
  transport: 'synthetic fresh initializer, no stale initializationPromise and no network',
});
