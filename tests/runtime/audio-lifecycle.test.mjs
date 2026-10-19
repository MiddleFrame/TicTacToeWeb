import assert from "node:assert/strict";
import test from "node:test";
import { createAnimationClock, createHookRuntime, loadFrontendModule, memoryStorage } from "../helpers/frontend-runtime.mjs";

test("inactive audio cannot start effects, pauses current sources and releases its context and listeners on unmount", () => {
  const hooks = createHookRuntime();
  const clock = createAnimationClock();
  const sources = [];
  let docks = 0;
  const listeners = new Map();
  const events = prefix => ({ addEventListener: (event, callback) => listeners.set(`${prefix}:${event}`, callback), removeEventListener: event => listeners.delete(`${prefix}:${event}`) });
  class Audio {
    constructor(src) { this.src = src; this.pauses = 0; sources.push(this); }
    addEventListener() {}
    play() { return Promise.resolve(); }
    pause() { this.pauses++; }
  }
  const contexts = [];
  class AudioContext {
    constructor() { this.suspends = 0; this.closes = 0; this.resumes = 0; contexts.push(this); }
    resume() { this.resumes++; return Promise.resolve(); }
    suspend() { this.suspends++; return Promise.resolve(); }
    close() { this.closes++; return Promise.resolve(); }
  }
  const { useGameAudio } = loadFrontendModule("app/components/game/hooks/useGameAudio.ts", {
    react: hooks.react,
    "../../../game/card-reveal-audio": { createCardRevealSoundscape: () => ({}), playCardDock() { docks++; } },
    "../../../game/card-reveal-profile": { cardRevealProfile: () => ({}) },
  }, { ...clock.globals, Audio, AudioContext,
    window: { ...clock.globals.window, ...events("window"), localStorage: memoryStorage() },
    document: { ...events("document"), visibilityState: "visible", hasFocus: () => true },
  });
  const render = active => { const audio = hooks.render(() => useGameAudio(active)); hooks.commit(); return audio; };
  let audio = render(true);
  audio.playSfx("click"); audio.playRevealDock("place");
  assert.equal(sources.length, 2);
  assert.equal(contexts.length, 1);
  audio = render(false);
  assert.ok(sources.every(source => source.pauses > 0));
  assert.ok(contexts[0].suspends > 0);
  const resumes = contexts[0].resumes;
  audio.playSfx("impact"); audio.playRevealDock("place");
  assert.equal(sources.length, 2);
  assert.equal(contexts.length, 1);
  assert.equal(contexts[0].resumes, resumes);
  assert.equal(docks, 1);
  audio = render(true);
  audio.playSfx("click");
  assert.equal(sources.length, 3);
  listeners.get("window:blur")();
  assert.ok(sources[2].pauses > 0);
  hooks.unmount();
  assert.equal(listeners.size, 0);
  assert.equal(clock.timers.size, 0);
  assert.equal(contexts[0].closes, 1);
});
