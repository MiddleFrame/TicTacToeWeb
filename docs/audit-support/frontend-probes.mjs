import vm from 'node:vm';
import ts from 'typescript';
import { importSource, readSource, writeResult } from './audit-paths.mjs';

const { createGame, playCard } = await importSource('app/game/engine.ts');
const results = [];

const transpile = (file) => ts.transpileModule(readSource(file), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;

const photonClients = [];
const acceptedStates = [];
const snapshots = [];
let connectCalls = 0;
let disconnectCalls = 0;
class FakePhotonClient {
  static State = { JoinedLobby: 1, Joined: 2, Disconnected: 3, Error: 4 };
  actorsArray = [{ actorNr: 1 }, { actorNr: 2 }];
  constructor() { photonClients.push(this); }
  disconnect() { disconnectCalls += 1; }
  connectToRegionMaster() { connectCalls += 1; }
  myActor() { return { actorNr: 1 }; }
  myRoom() { return { name: 'synthetic-room' }; }
}
const fakePhoton = {
  ConnectionProtocol: { Wss: 1 },
  LoadBalancing: { LoadBalancingClient: FakePhotonClient, Constants: { ReceiverGroup: { Others: 1 } } },
  setOnLoad: (callback) => callback(),
};
const photonExports = {};
vm.runInNewContext(transpile('app/game/photon.ts'), {
  exports: photonExports,
  require: (id) => id === 'photon-realtime' ? fakePhoton : {},
  console,
});
const session = new photonExports.PhotonGameSession({
  onOpponentLeave: () => {}, onSnapshot: (value) => snapshots.push(value.phase),
  onState: (value) => acceptedStates.push(value), onIntent: () => {},
});
const connecting = session.connect({ appId: 'synthetic-app', appVersion: 'synthetic', region: 'synthetic' });
session.disconnect();
await connecting;
const client = photonClients[0];
client.onEvent(11, { syntheticInvalidState: true }, 2);
session.disconnect();
client.onStateChange(FakePhotonClient.State.Joined);
results.push({
  probe: 'photon-lifecycle-and-input',
  clientsCreatedAfterCancel: photonClients.length,
  connectCallsAfterCancel: connectCalls,
  invalidStateFromGuestAccepted: acceptedStates.length,
  phaseAfterDisconnectedClientCallback: snapshots.at(-1),
  disconnectCalls,
});

const inputState = createGame();
inputState.hands[1] = [{ id: 'synthetic-freeze', kind: 'freeze-3' }];
const savedRandom = Math.random;
let randomLow;
let randomHigh;
try {
  Math.random = () => 0;
  randomLow = playCard(inputState, 'synthetic-freeze');
  Math.random = () => 0.999999;
  randomHigh = playCard(inputState, 'synthetic-freeze');
} finally {
  Math.random = savedRandom;
}
results.push({
  probe: 'engine-input-action-determinism',
  sameInputAndAction: true,
  frozenAtRandomLow: Object.keys(randomLow.frozen),
  frozenAtRandomHigh: Object.keys(randomHigh.frozen),
  byteIdenticalResult: JSON.stringify(randomLow) === JSON.stringify(randomHigh),
});

const effectCleanups = [];
const timeoutQueue = [];
let timeoutId = 0;
let elapsedMs = 0;
let clearCalls = 0;
const fakeReact = {
  useState: (initial) => [initial, () => {}],
  useRef: (initial) => ({ current: initial }),
  useEffect: (callback) => { const cleanup = callback(); if (cleanup) effectCleanups.push(cleanup); },
};
const animationExports = {};
vm.runInNewContext(transpile('app/components/game/hooks/useMatchmakingAnimation.ts'), {
  exports: animationExports, require: () => fakeReact,
  window: {
    setInterval: () => 1, clearInterval: () => {},
    setTimeout: (callback, duration) => { timeoutQueue.push({ callback, duration }); return ++timeoutId; },
    clearTimeout: () => { clearCalls += 1; },
  },
});
animationExports.useMatchmakingAnimation(false, false);
for (let index = 0; index < 10000; index += 1) {
  const timeout = timeoutQueue.shift();
  if (!timeout) throw new Error('Synthetic scheduler empty');
  elapsedMs += timeout.duration;
  timeout.callback();
  await Promise.resolve();
}
const livePendingTimers = timeoutQueue.length;
for (const cleanup of effectCleanups) cleanup();
results.push({
  probe: 'matchmaking-retained-timer-handles',
  simulatedTimerCallbacks: 10000,
  simulatedElapsedSeconds: elapsedMs / 1000,
  scheduledTimerIds: timeoutId,
  livePendingTimers,
  cleanupClearCalls: clearCalls,
  expiredIdsRetainedUntilCleanup: clearCalls - livePendingTimers,
});
writeResult('frontend-probes.json', results);
