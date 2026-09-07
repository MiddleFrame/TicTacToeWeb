import assert from "node:assert/strict";
import test from "node:test";
import {
  createAnimationClock, createHookRuntime, flushMicrotasks, jsxRuntime, loadFrontendModule,
} from "./helpers/frontend-runtime.mjs";

function loadSequence(clock) {
  return loadFrontendModule("app/game/animation-sequence.ts", {}, clock.globals);
}

function fakeAnimation() {
  let finish;
  let reject;
  let cancelCalls = 0;
  const finished = new Promise((resolve, onReject) => { finish = resolve; reject = onReject; });
  return {
    finished, finish,
    get cancelCalls() { return cancelCalls; },
    cancel() { cancelCalls += 1; reject(new Error("cancelled animation")); },
  };
}

test("animation sequence cancels active waits and frames without further work", async () => {
  const clock = createAnimationClock();
  const { AnimationSequence } = loadSequence(clock);
  const sequence = new AnimationSequence();
  let frames = 0;
  const waiting = sequence.wait(100);
  const framing = sequence.frame(() => { frames += 1; });
  sequence.cancel();
  assert.equal(await waiting, false);
  assert.equal(await framing, false);
  assert.equal(await sequence.wait(1), false);
  await clock.tickFrame();
  assert.equal(frames, 0);
  assert.equal(clock.timers.size, 0);
  assert.equal(clock.frames.size, 0);
});

test("animation cleanup releases both active and completed forwards-fill effects", async () => {
  const clock = createAnimationClock();
  const { AnimationSequence } = loadSequence(clock);
  const sequence = new AnimationSequence();
  const completed = fakeAnimation();
  const first = sequence.animate(completed);
  completed.finish();
  assert.equal(await first, true);
  const active = fakeAnimation();
  const second = sequence.animate(active);
  sequence.cancel();
  assert.equal(await second, false);
  assert.equal(completed.cancelCalls, 1);
  assert.equal(active.cancelCalls, 1);
});

test("matchmaking retains only live timer handles across 10000 completed waits", async () => {
  const clock = createAnimationClock();
  const hooks = createHookRuntime();
  const { useMatchmakingAnimation } = loadFrontendModule("app/components/game/hooks/useMatchmakingAnimation.ts", {
    react: hooks.react,
    "../../../game/animation-sequence": loadSequence(clock),
  }, clock.globals);
  hooks.render(() => useMatchmakingAnimation(false, false));
  hooks.commit();
  for (let index = 0; index < 10000; index += 1) {
    assert.equal(clock.timers.size, 1);
    await clock.tickTimer();
  }
  const writes = hooks.stateWrites;
  hooks.render(() => useMatchmakingAnimation(false, true));
  hooks.commit();
  await flushMicrotasks();
  assert.equal(clock.clears, 1);
  assert.equal(clock.timers.size, 0);
  assert.equal(clock.intervals.size, 0);
  assert.equal(hooks.stateWrites, writes);
});

function transferHarness({ needsScroll = false, reducedMotion = false } = {}) {
  const clock = createAnimationClock();
  clock.globals.window.matchMedia = () => ({ matches: reducedMotion });
  const hooks = createHookRuntime();
  const animations = [];
  const completed = [];
  const docked = [];
  const scroll = {
    scrollTop: 0, scrollHeight: 500, clientHeight: 100,
    getBoundingClientRect: () => ({ top: 0 }),
  };
  const target = {
    getBoundingClientRect: () => ({ left: 50, top: needsScroll ? 300 : 40, width: 20, height: 20 }),
  };
  const root = { querySelector: (selector) => selector === ".purchase-deck-scroll" ? scroll : target };
  const flight = {
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 30, height: 30 }),
    animate() { const animation = fakeAnimation(); animations.push(animation); return animation; },
  };
  const { CardDeckTransfer } = loadFrontendModule("app/components/game/CardDeckTransfer.tsx", {
    react: hooks.react,
    "react/jsx-runtime": jsxRuntime,
    "../../game/animation-sequence": loadSequence(clock),
    "../../game/card-transfer-layout": { cardTransferSlot: () => ({ direction: 1, insetPx: 0, rotationDeg: 0 }) },
    "../../game/localization": { useLocalization: () => ({ t: (key) => key }) },
    "./DeckCardGrid": { DeckCardGrid: "DeckCardGrid" },
    "./PurchaseCardFace": { PurchaseCardFace: "PurchaseCardFace" },
  }, clock.globals);
  const props = {
    kinds: ["place"], selectedKinds: [], unlockedKinds: [],
    onComplete: (kind) => completed.push(kind), playDock: (kind) => docked.push(kind),
  };
  function render(nextProps = props) {
    const tree = hooks.render(CardDeckTransfer, nextProps);
    tree.props.ref.current = root;
    for (const card of tree.props.children[1].props.children) card.props.ref(flight);
    hooks.commit();
  }
  render();
  return { clock, hooks, animations, completed, docked, scroll, props, render };
}

test("unmount during card scrolling cancels RAF without starting a flight", async () => {
  const runtime = transferHarness({ needsScroll: true });
  await runtime.clock.tickTimer();
  assert.equal(runtime.clock.frames.size, 1);
  await runtime.clock.tickFrame();
  const scrollTop = runtime.scroll.scrollTop;
  runtime.hooks.unmount();
  await flushMicrotasks();
  await runtime.clock.tickFrame();
  assert.equal(runtime.clock.frames.size, 0);
  assert.equal(runtime.clock.timers.size, 0);
  assert.equal(runtime.scroll.scrollTop, scrollTop);
  assert.equal(runtime.animations.length, 0);
  assert.equal(runtime.completed.length, 0);
});

test("unmount during a card flight cancels WAAPI and suppresses audio and completion", async () => {
  const runtime = transferHarness();
  await runtime.clock.tickTimer();
  await runtime.clock.tickTimer();
  assert.equal(runtime.animations.length, 1);
  const writes = runtime.hooks.stateWrites;
  runtime.hooks.unmount();
  await flushMicrotasks();
  assert.equal(runtime.animations[0].cancelCalls, 1);
  assert.equal(runtime.docked.length, 0);
  assert.equal(runtime.completed.length, 0);
  assert.equal(runtime.hooks.stateWrites, writes);
  assert.equal(runtime.clock.timers.size, 0);
});

test("callback identity changes keep the flight running and use the latest callbacks once", async () => {
  const runtime = transferHarness();
  await runtime.clock.tickTimer();
  await runtime.clock.tickTimer();
  const latestDock = [];
  const latestComplete = [];
  runtime.render({
    ...runtime.props,
    selectedKinds: ["place"],
    playDock: (kind) => latestDock.push(kind), onComplete: (kind) => latestComplete.push(kind),
  });
  assert.equal(runtime.animations[0].cancelCalls, 0);
  runtime.animations[0].finish();
  await flushMicrotasks();
  await runtime.clock.tickTimer();
  await runtime.clock.tickTimer();
  assert.deepEqual(latestDock, ["place"]);
  assert.deepEqual(latestComplete, ["place"]);
  assert.equal(runtime.docked.length, 0);
  assert.equal(runtime.completed.length, 0);
  assert.equal(runtime.animations.length, 1);
  runtime.hooks.unmount();
});

test("reduced-motion transfer cleanup cancels its delayed completion", async () => {
  const runtime = transferHarness({ reducedMotion: true });
  runtime.hooks.unmount();
  await flushMicrotasks();
  assert.equal(runtime.completed.length, 0);
  assert.equal(runtime.clock.timers.size, 0);
  assert.equal(runtime.animations.length, 0);
});

test("purchase refresh keeps transfer kinds identity for the same drops", () => {
  const hooks = createHookRuntime();
  const { CardPurchaseFlow } = loadFrontendModule("app/components/game/CardPurchaseFlow.tsx", {
    react: hooks.react,
    "react/jsx-runtime": jsxRuntime,
    "../../game/localization": { useLocalization: () => ({ t: (key) => key, language: "en" }) },
    "../../game/progression-copy": { progressionCopy: { en: {} } },
    "./CardDeckTransfer": { CardDeckTransfer: "CardDeckTransfer" },
    "./CardPurchaseReveal": { CardPurchaseReveal: "CardPurchaseReveal" },
    "./DuplicateDust": { DuplicateDust: "DuplicateDust" },
  });
  const props = {
    kinds: ["place"], drops: [{ kind: "place", duplicate: false }], passes: {},
    onAmbientSuspendedChange: () => {}, onComplete: () => {}, playDock: () => {},
    selectedKinds: [], unlockedKinds: [],
  };
  const reveal = hooks.render(CardPurchaseFlow, props);
  hooks.commit();
  reveal.props.onAccept();
  const transfer = hooks.render(CardPurchaseFlow, props);
  hooks.commit();
  const refreshed = hooks.render(CardPurchaseFlow, { ...props, selectedKinds: ["place"], passes: {} });
  hooks.commit();
  assert.equal(transfer.type, "CardDeckTransfer");
  assert.equal(refreshed.props.kinds, transfer.props.kinds);
});
