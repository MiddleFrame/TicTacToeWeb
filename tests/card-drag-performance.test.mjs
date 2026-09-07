import assert from "node:assert/strict";
import test from "node:test";
import { createAnimationClock, createHookRuntime, loadFrontendModule } from "./helpers/frontend-runtime.mjs";

export function dragFixture(file = "app/components/game/hooks/useCardDrag.ts") {
  const clock = createAnimationClock();
  const hooks = createHookRuntime();
  let hitTests = 0;
  const played = [];
  const board = { getBoundingClientRect: () => ({ left: 0, top: 0, right: 300, bottom: 300 }) };
  const document = { elementFromPoint(x) { hitTests++; return { closest: () => ({ dataset: { cellIndex: String(Math.floor(x / 100)) } }) }; } };
  const game = { hands: { 1: [{ id: "card", kind: "place" }, { id: "other", kind: "place" }] }, turn: 1, mana: 10 };
  const interaction = loadFrontendModule("app/game/card-interaction.ts", {});
  const { useCardDrag } = loadFrontendModule(file, {
    react: hooks.react,
    "../../../game/cards": { CARD_DEFINITIONS: { place: { target: "empty" } } },
    "../../../game/card-interaction": interaction,
    "../../../game/engine": { cardCost: () => 1 },
  }, { ...clock.globals, document });
  const render = () => hooks.render(() => useCardDrag(game, true, { current: board }, () => true, (...args) => played.push(args), () => {}));
  const event = (x, y = 20) => ({ clientX: x, clientY: y, pointerId: 1, currentTarget: {
    setPointerCapture() {}, dataset: {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 20, height: 20 }),
  } });
  render();
  hooks.commit();
  return { clock, hooks, render, event, played, hitTests: () => hitTests };
}

test("card movement coalesces 100 pointer events into one hit-test and state update", async () => {
  const f = dragFixture();
  f.render().begin(f.event(10), "card");
  const drag = f.render();
  const reads = f.hitTests();
  const writes = f.hooks.stateWrites;
  for (let x = 20; x < 120; x++) drag.move(f.event(x), "card");
  await f.clock.tickFrame();
  assert.equal(f.hitTests() - reads, 1);
  assert.equal(f.hooks.stateWrites - writes, 1);
  assert.equal(f.render().drag.x, 119);
});

test("hovering an idle card performs no drag hit-tests or state writes", () => {
  const f = dragFixture();
  const reads = f.hitTests();
  const writes = f.hooks.stateWrites;
  for (let i = 0; i < 100; i++) f.render().move(f.event(i), "card");
  assert.equal(f.hitTests(), reads);
  assert.equal(f.hooks.stateWrites, writes);
});

test("a stale cancel from the previous card cannot stop the current drag", async () => {
  const f = dragFixture();
  f.render().begin(f.event(10), "card");
  f.render().begin(f.event(10), "other");
  f.render().cancel("card");
  f.render().move(f.event(210), "other");
  await f.clock.tickFrame();
  assert.equal(f.render().drag.x, 210);
  f.render().finish(f.event(210), "other");
  assert.deepEqual(f.played, [["other", 2]]);
});

test("pointer-up uses final coordinates even before the scheduled movement frame", async () => {
  const f = dragFixture();
  f.render().begin(f.event(10), "card");
  const drag = f.render();
  drag.move(f.event(110), "card");
  drag.finish(f.event(210), "card");
  drag.finish(f.event(210), "card");
  assert.deepEqual(f.played, [["card", 2]]);
  assert.equal(f.clock.frames.size, 0);
  await f.clock.tickFrame();
  assert.equal(f.render().drag, null);
});

test("240 movements over 60 frames perform 60 hit-tests and preserve the last position", async () => {
  const f = dragFixture();
  f.render().begin(f.event(10), "card");
  const reads = f.hitTests();
  const writes = f.hooks.stateWrites;
  for (let frame = 0; frame < 60; frame++) {
    const drag = f.render();
    for (let sample = 0; sample < 4; sample++) drag.move(f.event(frame * 4 + sample), "card");
    await f.clock.tickFrame();
  }
  assert.equal(f.hitTests() - reads, 60);
  assert.equal(f.hooks.stateWrites - writes, 60);
  assert.equal(f.render().drag.x, 239);
});

for (const operation of ["cancel", "clearDrag", "unmount"]) {
  test(`pending movement is cancelled on ${operation}`, async () => {
    const f = dragFixture();
    f.render().begin(f.event(10), "card");
    f.render().move(f.event(110), "card");
    if (operation === "unmount") f.hooks.unmount();
    else f.render()[operation]("card");
    const writes = f.hooks.stateWrites;
    const reads = f.hitTests();
    await f.clock.tickFrame();
    assert.equal(f.clock.frames.size, 0);
    assert.equal(f.hooks.stateWrites, writes);
    assert.equal(f.hitTests(), reads);
    assert.equal(f.played.length, 0);
  });
}
