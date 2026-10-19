import assert from "node:assert/strict";
import test from "node:test";
import * as engine from "../../app/game/engine.ts";
import * as transition from "../../app/game/round-transition.ts";
import { createAnimationClock, createHookRuntime, loadFrontendModule } from "../helpers/frontend-runtime.mjs";

function fixture(side) {
  const clock = createAnimationClock();
  const hooks = createHookRuntime();
  let game = { ...engine.createGame(), phase: "round-over", roundWinner: 1, completedRounds: 1 };
  let writes = 0;
  const setGame = update => { writes++; game = update(game); };
  const { useGamePhaseEffects } = loadFrontendModule("app/components/game/hooks/useGamePhaseEffects.ts", {
    react: hooks.react, "../../../game/engine": engine, "../../../game/round-transition": transition,
  }, clock.globals);
  hooks.render(() => useGamePhaseEffects({ active: false, game, mode: "online", networkSide: side, setGame, playSfx: () => {} }));
  hooks.commit();
  return { clock, hooks, get game() { return game; }, get writes() { return writes; }, replace: next => { game = next; } };
}

test("only the host advances an online round after its result delay", async () => {
  const guest = fixture(2);
  assert.equal(guest.clock.timers.size, 0);
  const host = fixture(1);
  assert.equal(host.game.phase, "round-over");
  assert.equal([...host.clock.timers.values()][0].duration, transition.onlineRoundAdvanceDelay(1));
  await host.clock.tickTimer();
  assert.equal(host.game.phase, "playing");
  assert.equal(host.game.scoreToWin, 15);
  assert.equal(host.writes, 1);
  assert.equal(host.clock.timers.size, 0);
  host.hooks.unmount(); guest.hooks.unmount();
});

test("unmount cancels round advancement and a changed current phase cannot be overwritten", async () => {
  const cancelled = fixture(1);
  cancelled.hooks.unmount();
  assert.equal(cancelled.clock.timers.size, 0);
  assert.equal(cancelled.writes, 0);
  const stale = fixture(1);
  const current = engine.createGame();
  stale.replace(current);
  await stale.clock.tickTimer();
  assert.equal(stale.game, current);
  stale.hooks.unmount();
});
