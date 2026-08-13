import type { CardRevealCue, CardRevealProfile } from "./card-reveal-profile";

export type CardRevealAudioController = {
  accelerate: (multiplier: number) => void;
  stop: () => void;
};

const silentController: CardRevealAudioController = {
  accelerate: () => undefined,
  stop: () => undefined,
};

function tone(
  context: AudioContext,
  output: AudioNode,
  frequency: number,
  start: number,
  duration: number,
  gainValue: number,
  type: OscillatorType,
) {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(gainValue, start + Math.min(0.08, duration * 0.2));
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain).connect(output);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

function dock(context: AudioContext, output: AudioNode, profile: CardRevealProfile, cue: CardRevealCue) {
  const now = context.currentTime;
  const strength = cue.strength;
  const body = context.createOscillator();
  const bodyGain = context.createGain();
  body.type = "sine";
  body.frequency.setValueAtTime(profile.rootFrequency * 0.62, now);
  body.frequency.exponentialRampToValueAtTime(profile.rootFrequency * 0.22, now + 0.28);
  bodyGain.gain.setValueAtTime(0.0001, now);
  bodyGain.gain.exponentialRampToValueAtTime(0.12 * strength, now + 0.012);
  bodyGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.34);
  body.connect(bodyGain).connect(output);
  body.start(now);
  body.stop(now + 0.36);
  tone(context, output, profile.rootFrequency * 2.08, now + 0.008, 0.2, 0.04 * strength, "triangle");
  tone(context, output, profile.rootFrequency * 3.01, now + 0.025, 0.13, 0.025 * strength, "sine");
}

function light(context: AudioContext, output: AudioNode, profile: CardRevealProfile, cue: CardRevealCue) {
  const now = context.currentTime;
  [2, 2.5, 3, 4].forEach((ratio, index) => {
    tone(
      context,
      output,
      profile.rootFrequency * ratio,
      now + index * 0.085,
      0.75 - index * 0.06,
      (0.035 - index * 0.004) * cue.strength,
      index % 2 === 0 ? "sine" : "triangle",
    );
  });
}

const cuePlayers: Readonly<Record<CardRevealCue["sound"], typeof dock>> = { dock, light };

function background(context: AudioContext, output: AudioNode, profile: CardRevealProfile) {
  const now = context.currentTime;
  const duration = profile.durationMs / 1000 + 1.5;
  [0.5, 0.75, 1].forEach((ratio, index) => {
    tone(
      context,
      output,
      profile.rootFrequency * ratio,
      now,
      duration,
      0.018 - index * 0.003,
      index === 1 ? "triangle" : "sine",
    );
  });
}

export function createCardRevealSoundscape(
  context: AudioContext | null,
  profile: CardRevealProfile,
): CardRevealAudioController {
  if (!context) return silentController;
  const master = context.createGain();
  master.gain.setValueAtTime(0.72, context.currentTime);
  master.connect(context.destination);
  background(context, master, profile);
  let timelineMs = 0;
  let playbackRate = profile.playbackRate;
  let lastUpdatedAt = performance.now();
  let stopped = false;
  const fired = new Set<number>();
  let timers: number[] = [];

  const updateTimeline = () => {
    const now = performance.now();
    timelineMs += (now - lastUpdatedAt) * playbackRate;
    lastUpdatedAt = now;
  };

  const clearTimers = () => {
    timers.forEach((timer) => window.clearTimeout(timer));
    timers = [];
  };

  const schedule = () => {
    clearTimers();
    profile.cues.forEach((cue, index) => {
      if (fired.has(index)) return;
      const delay = Math.max(0, (cue.atMs - timelineMs) / playbackRate);
      timers.push(window.setTimeout(() => {
        if (stopped) return;
        fired.add(index);
        cuePlayers[cue.sound](context, master, profile, cue);
      }, delay));
    });
  };

  schedule();
  return {
    accelerate(multiplier) {
      if (stopped) return;
      updateTimeline();
      playbackRate = profile.playbackRate * multiplier;
      schedule();
    },
    stop() {
      if (stopped) return;
      stopped = true;
      clearTimers();
      const now = context.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(Math.max(master.gain.value, 0.0001), now);
      master.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
      window.setTimeout(() => master.disconnect(), 220);
    },
  };
}

export function playCardDock(
  context: AudioContext | null,
  profile: CardRevealProfile,
  strength = 1,
) {
  if (!context) return;
  const master = context.createGain();
  master.gain.setValueAtTime(0.78, context.currentTime);
  master.connect(context.destination);
  dock(context, master, profile, { atMs: 0, sound: "dock", strength });
  window.setTimeout(() => master.disconnect(), 600);
}
