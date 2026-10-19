import assert from "node:assert/strict";
import test from "node:test";
import * as engine from "../../app/game/engine.ts";
import * as presentation from "../../app/game/game-presentation.ts";
import * as roguelike from "../../app/game/roguelike.ts";
import * as progressPolicy from "../../app/game/roguelite-progress.ts";
import * as progressStorage from "../../app/game/roguelite-storage.ts";
import { STARTER_SELECTED_KINDS } from "../../app/game/cards.ts";
import { createAnimationClock, createHookRuntime, flushMicrotasks, jsxRuntime, loadFrontendModule } from "../helpers/frontend-runtime.mjs";
import { memoryStorage } from "../helpers/frontend-runtime.mjs";

function runtimeFixture(roguelite) {
  const hooks = createHookRuntime();
  const clock = createAnimationClock();
  const records = [];
  const starts = [];
  const results = [];
  const noop = () => undefined;
  const online = { network: { phase: "idle", side: null }, disconnect: noop, connect: noop };
  const { useRoundProgression } = loadFrontendModule("app/components/game/hooks/useRoundProgression.ts", { react: hooks.react }, { ...clock.globals, crypto });
  const { GameRuntime } = loadFrontendModule("app/components/GameRuntime.tsx", {
    react: hooks.react, "react/jsx-runtime": jsxRuntime,
    "../game/engine": { ...engine, playCard: (game) => ({ ...game, phase: "game-over", roundWinner: 1, gameWinner: 1 }) },
    "../game/game-presentation": presentation,
    "../game/roguelike": roguelike,
    "./game/GameScene": { GameScene: noop },
    "./game/hooks/useDamageSequence": { useDamageSequence: () => ({ flights: [], clearFlights: noop, setCellRef: noop, setHealthRef: noop, previewDamage: {} }) },
    "./game/hooks/useCardDrag": { useCardDrag: (game, _human, _board, _can, play) => ({ clearDrag: noop, begin: () => play(game.hands[1][0].id, 0) }) },
    "./game/hooks/useRoundProgression": { useRoundProgression },
    "./game/hooks/useScenePattern": { useScenePattern: noop },
    "./game/hooks/useGamePhaseEffects": { useGamePhaseEffects: noop },
    "./game/hooks/useOpponentTurns": { useOpponentTurns: noop },
    "./game/hooks/usePhotonGame": { usePhotonGame: () => online },
    "./game/hooks/useTurnBanner": { useTurnBanner: () => ({ hide: noop, show: noop, player: null }) },
    "../game/localization": { useLocalization: () => ({ action: (v) => v, t: (v) => v }) },
    "../game/photon-config": { isPhotonConfigured: () => true, PHOTON_GAME_CONFIG: {} },
  }, { ...clock.globals, crypto, document: { body: { dataset: {} } } });
  const props = {
    roguelite, active: true,
    selectedKinds: [...STARTER_SELECTED_KINDS],
    audio: { playSfx: noop },
    recordRound: async (...args) => { records.push(args); return []; },
    onRogueliteStart: (id) => { starts.push(id); return true; },
    onRogueliteResult: (...args) => { results.push(args); return true; },
    renderExperience: () => null,
    renderNavigation: (v) => v,
  };
  const render = () => { const element = hooks.render(() => GameRuntime(props)); hooks.commit(); return element; };
  return { render, hooks, clock, records, starts, results, props };
}

test("new TTTR gameplay never records Plus XP and commits only to its run port", async () => {
  const f = runtimeFixture(true);
  let scene = f.render();
  scene.props.onStart("bot");
  assert.equal(f.render().props.screen, "menu");
  scene.props.onStart("roguelike");
  scene = f.render();
  assert.equal(scene.props.mode, "roguelike");
  assert.equal(f.starts.length, 1);
  scene.props.onCardDown();
  scene = f.render();
  assert.equal(scene.props.game.phase, "game-over");
  while (f.clock.timers.size) await f.clock.tickTimer();
  assert.equal(f.records.length, 0);
  scene.props.onContinue();
  scene = f.render();
  assert.equal(f.results.length, 1);
  assert.equal(f.results[0][0], f.starts[0]);
  assert.equal(scene.props.roguelike.victories, 1);
  assert.equal(scene.props.roguelike.status, "reward");
  f.hooks.unmount();
});

test("TTTP retains ordinary match progression and cannot start the roguelite game", async () => {
  const f = runtimeFixture(false);
  let scene = f.render();
  scene.props.onStart("roguelike");
  assert.equal(f.render().props.screen, "menu");
  assert.equal(f.starts.length, 0);
  scene.props.onStart("bot");
  scene = f.render();
  assert.equal(scene.props.mode, "bot");
  scene.props.onCardDown();
  scene = f.render();
  assert.equal(scene.props.game.phase, "game-over");
  while (f.clock.timers.size) await f.clock.tickTimer();
  await flushMicrotasks();
  assert.equal(f.records.length, 1);
  assert.equal(f.records[0][2], "win");
  assert.equal(f.records[0][3], "bot");
  assert.equal(f.results.length, 0);
  f.hooks.unmount();
});

test("TTTR cannot expose a started run or advance a result before its save succeeds", () => {
  const f = runtimeFixture(true);
  f.props.onRogueliteStart = () => false;
  let scene = f.render();
  scene.props.onStart("roguelike");
  assert.equal(f.render().props.screen, "menu");
  f.props.onRogueliteStart = () => true;
  scene = f.render();
  scene.props.onStart("roguelike");
  scene = f.render();
  scene.props.onCardDown();
  f.props.onRogueliteResult = () => false;
  scene = f.render();
  scene.props.onContinue();
  assert.equal(f.render().props.roguelike.status, "playing");
  scene.props.onMenu();
  assert.equal(f.render().props.game.phase, "game-over");
  f.hooks.unmount();
  assert.equal(f.clock.timers.size, 0);
});

test("TTTR storage failure retains the saved statistics and supports the same result retry", async () => {
  const hooks = createHookRuntime();
  const clock = createAnimationClock();
  const storage = memoryStorage();
  clock.globals.window.localStorage = storage;
  const { useRogueliteProgress } = loadFrontendModule("app/components/game/hooks/useRogueliteProgress.ts", {
    react: hooks.react,
    "../../../game/roguelite-progress": progressPolicy,
    "../../../game/roguelite-storage": progressStorage,
  }, clock.globals);
  const render = () => { const p = hooks.render(useRogueliteProgress); hooks.commit(); return p; };
  render();
  await clock.tickTimer();
  let p = render();
  assert.equal(p.start("saved-run"), true);
  const before = roguelike.createRoguelikeRun();
  const after = roguelike.resolveRoguelikeResult(before, 1);
  const saved = storage.getItem("tttr-progress-v1");
  const write = storage.setItem;
  storage.setItem = () => { throw new Error("quota exceeded"); };
  p = render();
  assert.equal(p.resolve("saved-run", before, after), false);
  assert.equal(render().progress.victories, 0);
  assert.equal(storage.getItem("tttr-progress-v1"), saved);
  storage.setItem = write;
  assert.equal(render().resolve("saved-run", before, after), true);
  p = render();
  assert.equal(p.progress.victories, 1);
  assert.equal(p.resolve("saved-run", before, after), true);
  assert.equal(render().progress.victories, 1);
  hooks.unmount();
});
