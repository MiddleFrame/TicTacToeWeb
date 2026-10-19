import assert from "node:assert/strict";
import test from "node:test";
import { gameWorld } from "../../app/game/game-world.ts";
import { initialRogueliteProgress, beginRogueliteRun, recordRogueliteStage } from "../../app/game/roguelite-progress.ts";
import { readRogueliteProgress, writeRogueliteProgress } from "../../app/game/roguelite-storage.ts";
import { createHookRuntime, createAnimationClock, loadFrontendModule, flushMicrotasks } from "../helpers/frontend-runtime.mjs";
import { deferred, memoryStorage } from "../helpers/frontend-runtime.mjs";

function worldFixture(saved = "tttp") {
  const runtime = createHookRuntime();
  const clock = createAnimationClock();
  const storage = memoryStorage();
  storage.setItem("tttp-default-world-v1", saved);
  clock.globals.window.localStorage = storage;
  const requests = [];
  const preferences = {
    readWorldPreference: async () => gameWorld(storage.getItem("tttp-default-world-v1")),
    writeWorldPreference: async world => { storage.setItem("tttp-default-world-v1", world); },
  };
  const { useGameWorld } = loadFrontendModule("app/components/game/hooks/useGameWorld.ts", {
    react: runtime.react,
    "../../../game/world-preference": preferences,
    "../world-scenes": { loadWorld: (world) => {
      const result = deferred();
      requests.push({ world, ...result });
      return result.promise;
    } },
  }, clock.globals);
  const render = () => { const result = runtime.render(useGameWorld); runtime.commit(); return result; };
  const complete = async (request) => {
    request.resolve({ world: request.world, component: () => null });
    await clock.tickTimer();
    return render();
  };
  return { render, complete, requests, clock, storage, runtime, preferences };
}

test("startup restores TTTR before requesting either game and persists a deliberate default", async () => {
  const f = worldFixture("tttr");
  assert.equal(f.render().scene, null);
  assert.equal(f.requests.length, 0);
  await f.clock.tickTimer();
  assert.equal(f.render().target, "tttr");
  assert.deepEqual(f.requests.map((r) => r.world), ["tttr"]);
  let world = await f.complete(f.requests[0]);
  assert.equal(world.scene.world, "tttr");
  assert.equal(world.loading, false);
  world.switchWorld("tttp");
  f.render();
  world = await f.complete(f.requests[1]);
  assert.equal(f.storage.getItem("tttp-default-world-v1"), "tttr");
  world.makeDefault();
  await flushMicrotasks();
  assert.equal(f.render().defaultWorld, "tttp");
  assert.equal(f.storage.getItem("tttp-default-world-v1"), "tttp");
  f.runtime.unmount();
});

test("a transition waits for both the module and animation", async () => {
  const f = worldFixture();
  f.render();
  await f.clock.tickTimer();
  f.render();
  await f.clock.tickTimer();
  assert.equal(f.render().scene, null);
  f.requests[0].resolve({ world: "tttp", component: () => null });
  await flushMicrotasks();
  assert.equal(f.render().scene.world, "tttp");
  f.runtime.unmount();
});

test("cancellation and newer transitions invalidate outstanding module loads", async () => {
  const f = worldFixture();
  f.render();
  await f.clock.tickTimer();
  f.render();
  let world = await f.complete(f.requests[0]);
  world.switchWorld("tttr");
  world = f.render();
  await f.clock.tickTimer();
  world.cancel();
  world = f.render();
  f.requests[1].resolve({ world: "tttr", component: () => null });
  await flushMicrotasks();
  assert.equal(f.render().scene.world, "tttp");
  world.switchWorld("tttr");
  f.render();
  world.switchWorld("tttp");
  f.render();
  world = await f.complete(f.requests[3]);
  f.requests[2].resolve({ world: "tttr", component: () => null });
  await flushMicrotasks();
  assert.equal(world.scene.world, "tttp");
  assert.equal(f.render().scene.world, "tttp");
  f.runtime.unmount();
  assert.equal(f.clock.timers.size, 0);
});

test("failed imports support retry and unmount suppresses stale state writes", async () => {
  const f = worldFixture("tttr");
  f.render();
  await f.clock.tickTimer();
  f.render();
  f.requests[0].reject(new Error("offline"));
  await flushMicrotasks();
  let world = f.render();
  assert.equal(world.failed, true);
  world.retry();
  world = f.render();
  assert.equal(world.failed, false);
  assert.equal(f.requests[1].world, "tttr");
  await f.clock.tickTimer();
  f.runtime.unmount();
  const writes = f.runtime.stateWrites;
  f.requests[1].resolve({ world: "tttr", component: () => null });
  await flushMicrotasks();
  assert.equal(f.runtime.stateWrites, writes);
  assert.equal(f.clock.timers.size, 0);
});

test("unavailable preference storage falls back to Plus and does not report a saved default", async () => {
  const f = worldFixture("tttr");
  f.storage.getItem = () => { throw new Error("storage denied"); };
  f.storage.setItem = () => { throw new Error("storage denied"); };
  f.render();
  await f.clock.tickTimer();
  f.render();
  const world = await f.complete(f.requests[0]);
  assert.equal(world.scene.world, "tttp");
  assert.equal(world.preferenceFailed, true);
  world.makeDefault();
  assert.equal(f.render().preferenceFailed, true);
  f.runtime.unmount();
});

test("a pending native preference restore cannot load a scene after its owner unmounts", async () => {
  const f = worldFixture();
  const read = deferred();
  f.preferences.readWorldPreference = () => read.promise;
  f.render();
  await f.clock.tickTimer();
  assert.equal(f.requests.length, 0);
  f.runtime.unmount();
  const writes = f.runtime.stateWrites;
  read.resolve("tttr");
  await flushMicrotasks();
  assert.equal(f.requests.length, 0);
  assert.equal(f.runtime.stateWrites, writes);
});

test("a late startup preference cannot replace a newer player navigation", async () => {
  const f = worldFixture();
  const read = deferred();
  f.preferences.readWorldPreference = () => read.promise;
  f.render();
  await f.clock.tickTimer();
  f.render().switchWorld("tttr");
  f.render();
  read.resolve("tttp");
  await flushMicrotasks();
  assert.equal(f.render().target, "tttr");
  assert.equal(f.render().defaultWorld, "tttp");
  assert.deepEqual(f.requests.map(request => request.world), ["tttr"]);
  f.runtime.unmount();
});

test("a late startup read cannot replace an acknowledged newer default", async () => {
  for (const failure of [false, true]) {
    const f = worldFixture();
    const read = deferred();
    f.preferences.readWorldPreference = () => read.promise;
    f.render(); await f.clock.tickTimer();
    f.render().switchWorld("tttr"); f.render();
    const world = await f.complete(f.requests[0]);
    world.makeDefault(); await flushMicrotasks();
    assert.equal(f.render().defaultWorld, "tttr");
    if (failure) read.reject(new Error("late bridge failure"));
    else read.resolve("tttp");
    await flushMicrotasks();
    assert.equal(f.render().defaultWorld, "tttr");
    assert.equal(f.render().preferenceFailed, false);
    assert.equal(f.storage.getItem("tttp-default-world-v1"), "tttr");
    f.runtime.unmount();
  }
});

test("a native default write stays pending until acknowledgement and failed persistence remains retryable", async () => {
  const f = worldFixture("tttr");
  f.render(); await f.clock.tickTimer(); f.render();
  let world = await f.complete(f.requests[0]);
  world.switchWorld("tttp"); f.render();
  world = await f.complete(f.requests[1]);
  const write = deferred();
  const calls = [];
  f.preferences.writeWorldPreference = target => { calls.push(target); return write.promise; };
  world.makeDefault(); world.makeDefault();
  assert.deepEqual(calls, ["tttp"]);
  assert.equal(f.render().preferencePending, true);
  assert.equal(f.render().defaultWorld, "tttr");
  write.reject(new Error("disk full")); await flushMicrotasks();
  world = f.render();
  assert.equal(world.preferencePending, false);
  assert.equal(world.preferenceFailed, true);
  assert.equal(world.defaultWorld, "tttr");
  f.preferences.writeWorldPreference = async target => { calls.push(target); };
  world.makeDefault(); await flushMicrotasks();
  assert.equal(f.render().defaultWorld, "tttp");
  assert.equal(f.render().preferenceFailed, false);
  f.runtime.unmount();
});

test("a late native default write cannot update an unmounted world owner", async () => {
  const f = worldFixture();
  f.render(); await f.clock.tickTimer(); f.render();
  const world = await f.complete(f.requests[0]);
  const write = deferred();
  f.preferences.writeWorldPreference = () => write.promise;
  world.makeDefault();
  f.runtime.unmount();
  const writes = f.runtime.stateWrites;
  write.resolve(); await flushMicrotasks();
  assert.equal(f.runtime.stateWrites, writes);
});

test("TTTR stage progress is durable, independent of every Plus key and replay safe", () => {
  const storage = memoryStorage();
  const plus = { coins: 543, unlockedKinds: ["place"], passes: { regular: { xp: 100 } } };
  storage.setItem("tttp-local-progress-v2", JSON.stringify(plus));
  storage.setItem("tttp-progress-operations-v1", "pending-operations");
  let progress = beginRogueliteRun(initialRogueliteProgress(), "run-1");
  progress = recordRogueliteStage(progress, "run-1", 0, true);
  assert.equal(recordRogueliteStage(progress, "run-1", 0, true), progress);
  progress = recordRogueliteStage(progress, "run-1", 1, false);
  assert.equal(recordRogueliteStage(progress, "run-1", 1, false), progress);
  assert.throws(() => recordRogueliteStage(progress, "run-1", 2, true));
  writeRogueliteProgress(storage, progress);
  assert.deepEqual(readRogueliteProgress(storage), progress);
  assert.equal(progress.victories, 1);
  assert.equal(progress.bestVictories, 1);
  progress = beginRogueliteRun(progress, "run-2");
  assert.equal(progress.runsStarted, 2);
  assert.throws(() => recordRogueliteStage(progress, "run-1", 0, true), /run-changed/);
  assert.deepEqual(JSON.parse(storage.getItem("tttp-local-progress-v2")), plus);
  assert.equal(storage.getItem("tttp-progress-operations-v1"), "pending-operations");
});

test("invalid and future TTTR saves are retained, while missing saves start separately", () => {
  const storage = memoryStorage();
  assert.deepEqual(readRogueliteProgress(storage), initialRogueliteProgress());
  for (const invalid of ["{broken", "null", JSON.stringify({ ...initialRogueliteProgress(), version: 2 }),
    JSON.stringify({ ...initialRogueliteProgress(), victories: -1 })]) {
    storage.setItem("tttr-progress-v1", invalid);
    assert.throws(() => readRogueliteProgress(storage));
    assert.equal(storage.getItem("tttr-progress-v1"), invalid);
  }
  assert.equal(gameWorld("unknown"), "tttp");
});
