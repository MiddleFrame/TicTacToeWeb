import assert from "node:assert/strict";
import test from "node:test";
import { dragFixture } from "../helpers/card-drag.mjs";

test("cancel returns the card home, settles it, then clears positioning without playing", async () => {
  const f = dragFixture();
  f.render().begin(f.event(10), "card");
  f.render().move(f.event(210), "card");
  await f.clock.tickFrame();
  f.render().cancel("card");
  const returning = f.render().drag;
  assert.equal(returning.phase, "returning");
  assert.equal(returning.x, returning.homeX);
  assert.equal(returning.y, returning.homeY);
  await f.clock.tickTimer();
  assert.equal(f.render().drag.phase, "settled");
  await f.clock.tickTimer();
  assert.equal(f.render().drag, null);
  assert.equal(f.clock.timers.size, 0);
  assert.deepEqual(f.played, []);
});

test("starting another drag invalidates the previous return timer", async () => {
  const f = dragFixture();
  f.render().begin(f.event(10), "card");
  f.render().cancel("card");
  f.render().begin(f.event(10), "other");
  assert.equal(f.clock.timers.size, 1);
  await f.clock.tickTimer();
  assert.equal(f.render().drag.cardId, "other");
  assert.equal(f.render().drag.phase, "holding");
  f.hooks.unmount();
  assert.equal(f.clock.timers.size, 0);
});
