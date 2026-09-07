import assert from "node:assert/strict";
import test from "node:test";
import * as engine from "../app/game/engine.ts";
import * as networkMessage from "../app/game/network-message.ts";
import { loadFrontendModule, flushMicrotasks } from "./helpers/frontend-runtime.mjs";

const config = { appId: "synthetic-app", appVersion: "test", region: "test" };

function harness({ side = 1, deferredLoad = false, deferredImport = false } = {}) {
  const clients = [];
  const snapshots = [];
  const states = [];
  const intents = [];
  const winners = [];
  const onLoads = [];
  class Client {
    static State = { JoinedLobby: 1, Joined: 2, Disconnected: 3, Error: 4 };
    actorsArray = [{ actorNr: 1 }, { actorNr: 2 }];
    joined = true;
    connectCalls = 0;
    disconnectCalls = 0;
    events = [];
    constructor() { clients.push(this); }
    myActor() { return { actorNr: side }; }
    myRoom() { return { name: "synthetic-room" }; }
    isJoinedToRoom() { return this.joined; }
    connectToRegionMaster() { this.connectCalls += 1; return true; }
    joinRandomOrCreateRoom() { return true; }
    raiseEvent(...event) { this.events.push(event); }
    disconnect() {
      this.disconnectCalls += 1;
      this.onStateChange(Client.State.Disconnected);
      this.onActorLeave({ actorNr: side });
    }
  }
  const photon = {
    ConnectionProtocol: { Wss: 1 },
    LoadBalancing: { LoadBalancingClient: Client, Constants: { ReceiverGroup: { Others: 1 } } },
    setOnLoad(callback) { if (deferredLoad) onLoads.push(callback); else callback(); },
  };
  let resolveImport;
  let rejectImport;
  const imported = deferredImport ? new Promise((resolve, reject) => {
    resolveImport = resolve;
    rejectImport = reject;
  }) : photon;
  const { PhotonGameSession } = loadFrontendModule("app/game/photon.ts", {
    "./engine.ts": engine,
    "./network-message.ts": networkMessage,
    "photon-realtime": () => imported,
  });
  const session = new PhotonGameSession({
    onSnapshot: (snapshot) => snapshots.push(snapshot),
    onState: (state) => states.push(state),
    onIntent: (intent) => intents.push(intent),
    onOpponentLeave: (winner) => winners.push(winner),
  });
  return {
    session, clients, snapshots, states, intents, winners, onLoads, Client,
    resolveImport: () => resolveImport(photon), rejectImport,
    async ready() {
      await session.connect(config);
      clients.at(-1).onStateChange(Client.State.Joined);
      return clients.at(-1);
    },
  };
}

test("a cancelled module import never constructs or connects a Photon client", async () => {
  const runtime = harness({ deferredImport: true });
  const connecting = runtime.session.connect(config);
  await flushMicrotasks();
  runtime.session.disconnect();
  runtime.resolveImport();
  await connecting;
  assert.equal(runtime.clients.length, 0);
  assert.equal(runtime.snapshots.at(-1).phase, "idle");
});

test("a cancelled import rejection does not overwrite the idle snapshot", async () => {
  const runtime = harness({ deferredImport: true });
  const connecting = runtime.session.connect(config);
  await flushMicrotasks();
  runtime.session.disconnect();
  runtime.rejectImport(new Error("synthetic import failure"));
  await connecting;
  assert.equal(runtime.snapshots.at(-1).phase, "idle");
});

test("a replacement connect wins when both attempts await the same module", async () => {
  const runtime = harness({ deferredImport: true });
  const old = runtime.session.connect(config);
  await flushMicrotasks();
  runtime.session.disconnect();
  const current = runtime.session.connect(config);
  runtime.resolveImport();
  await Promise.all([old, current]);
  assert.equal(runtime.clients.length, 1);
  assert.equal(runtime.clients[0].connectCalls, 1);
  runtime.clients[0].onStateChange(runtime.Client.State.Joined);
  assert.equal(runtime.snapshots.at(-1).phase, "ready");
});

test("old callbacks and a late Photon onLoad cannot affect a replacement session", async () => {
  const runtime = harness({ deferredLoad: true });
  const old = await runtime.ready();
  const callbacks = {
    state: old.onStateChange, event: old.onEvent, join: old.onActorJoin,
    leave: old.onActorLeave, error: old.onError,
  };
  runtime.session.disconnect();
  const current = await runtime.ready();
  const before = runtime.snapshots.length;
  callbacks.state(runtime.Client.State.Joined);
  callbacks.event(12, { type: "end-turn" }, 2);
  callbacks.join({ actorNr: 2 });
  callbacks.leave({ actorNr: 2 });
  callbacks.error(1, "old error");
  runtime.onLoads[0]();
  runtime.onLoads[1]();
  assert.equal(runtime.snapshots.length, before);
  assert.equal(runtime.intents.length, 0);
  assert.equal(runtime.winners.length, 0);
  assert.equal(old.connectCalls, 0);
  assert.equal(current.connectCalls, 1);
});

test("the host accepts only valid intents from a registered opponent", async () => {
  const runtime = harness();
  const client = await runtime.ready();
  const intent = { type: "end-turn" };
  client.onEvent(11, engine.createGame(), 2);
  client.onEvent(12, intent, 1);
  client.onEvent(12, intent, 3);
  client.onEvent(12, { type: "play", cardId: "card", targetIndex: "0" }, 2);
  assert.equal(runtime.states.length, 0);
  assert.equal(runtime.intents.length, 0);
  client.onEvent(12, intent, 2);
  assert.deepEqual(runtime.intents, [intent]);
  runtime.session.sendIntent(intent);
  runtime.session.broadcastState(engine.createGame());
  assert.deepEqual(client.events.map(([code]) => code), [11]);
});

test("the guest accepts only structurally valid state from actor 1", async () => {
  const runtime = harness({ side: 2 });
  const client = await runtime.ready();
  const state = engine.createGame();
  client.onEvent(11, state, 2);
  client.onEvent(11, state, 3);
  client.onEvent(11, { board: [] }, 1);
  client.onEvent(12, { type: "end-turn" }, 1);
  assert.equal(runtime.states.length, 0);
  assert.equal(runtime.intents.length, 0);
  client.onEvent(11, state, 1);
  assert.deepEqual(runtime.states, [state]);
  client.joined = false;
  client.onEvent(11, state, 1);
  assert.equal(runtime.states.length, 1);
  client.joined = true;
  runtime.session.broadcastState(state);
  runtime.session.sendIntent({ type: "end-turn" });
  assert.deepEqual(client.events.map(([code]) => code), [12]);
});

test("waiting clients cannot accept gameplay messages", async () => {
  const runtime = harness();
  await runtime.session.connect(config);
  const client = runtime.clients[0];
  client.actorsArray = [{ actorNr: 1 }];
  client.onStateChange(runtime.Client.State.Joined);
  client.onEvent(12, { type: "end-turn" }, 2);
  assert.equal(runtime.intents.length, 0);
  assert.equal(runtime.snapshots.at(-1).phase, "waiting");
});

test("opponent departure awards once and synchronous disconnect callbacks are ignored", async () => {
  const runtime = harness();
  const client = await runtime.ready();
  const leave = client.onActorLeave;
  leave({ actorNr: 1 });
  leave({ actorNr: 3 });
  assert.equal(runtime.winners.length, 0);
  leave({ actorNr: 2 });
  leave({ actorNr: 2 });
  assert.deepEqual(runtime.winners, [1]);
  assert.equal(client.disconnectCalls, 1);
  assert.equal(runtime.snapshots.at(-1).phase, "opponent-left");
});

test("unexpected disconnect releases the client and exposes a retryable error", async () => {
  const runtime = harness();
  const client = await runtime.ready();
  client.onActorLeave({ actorNr: 2 }, true);
  assert.equal(runtime.winners.length, 0);
  client.onStateChange(runtime.Client.State.Disconnected);
  assert.equal(runtime.snapshots.at(-1).phase, "error");
  assert.equal(runtime.snapshots.at(-1).side, null);
  const replacement = await runtime.ready();
  assert.notEqual(replacement, client);
  assert.equal(runtime.snapshots.at(-1).phase, "ready");
});
