import type { CardRevealCue, CardRevealProfile } from "./card-reveal-profile";

export type CardRevealAudioController = {
  accelerate: (multiplier: number) => void;
  stop: () => void;
};

const silentController: CardRevealAudioController = {
  accelerate: () => undefined,
  stop: () => undefined,
};

function chipTone(
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
  gain.gain.exponentialRampToValueAtTime(gainValue, start + Math.min(0.012, duration * 0.16));
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
  body.type = "square";
  body.frequency.setValueAtTime(150, now);
  body.frequency.exponentialRampToValueAtTime(68, now + 0.12);
  bodyGain.gain.setValueAtTime(0.075 * strength, now);
  bodyGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.13);
  body.connect(bodyGain).connect(output);
  body.start(now);
  body.stop(now + 0.14);

  const sampleCount = Math.floor(context.sampleRate * 0.075);
  const buffer = context.createBuffer(1, sampleCount, context.sampleRate);
  const samples = buffer.getChannelData(0);
  for (let index = 0; index < samples.length; index += 1) {
    samples[index] = (Math.random() * 2 - 1) * (1 - index / samples.length);
  }
  const noise = context.createBufferSource();
  const noiseFilter = context.createBiquadFilter();
  const noiseGain = context.createGain();
  noise.buffer = buffer;
  noiseFilter.type = "bandpass";
  noiseFilter.frequency.setValueAtTime(820, now);
  noiseFilter.Q.setValueAtTime(0.8, now);
  noiseGain.gain.setValueAtTime(0.055 * strength, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.075);
  noise.connect(noiseFilter).connect(noiseGain).connect(output);
  noise.start(now);
  chipTone(context, output, 920, now, 0.045, 0.028 * strength, "square");
}

function light(context: AudioContext, output: AudioNode, profile: CardRevealProfile, cue: CardRevealCue) {
  const now = context.currentTime;
  [2, 2.5, 3, 4, 5].forEach((ratio, index) => {
    chipTone(
      context,
      output,
      profile.rootFrequency * ratio,
      now + index * 0.075,
      index === 4 ? 0.32 : 0.095,
      (index === 4 ? 0.026 : 0.034) * cue.strength,
      index === 4 ? "triangle" : "square",
    );
  });
}

const cuePlayers: Readonly<Record<CardRevealCue["sound"], typeof dock>> = { dock, light };

function background(context: AudioContext, output: AudioNode, profile: CardRevealProfile) {
  const now = context.currentTime;
  const motif = [1, 1.25, 1.5, 2];
  const motifDuration = 0.92;
  const repeats = Math.ceil(profile.durationMs / 1000 / motifDuration);
  Array.from({ length: repeats }, (_, repeat) => repeat).forEach((repeat) => {
    motif.forEach((ratio, index) => {
      chipTone(
        context,
        output,
        profile.rootFrequency * ratio,
        now + repeat * motifDuration + index * 0.105,
        0.07,
        0.008,
        "square",
      );
    });
  });
}

export function createCardRevealSoundscape(
  context: AudioContext | null,
  profile: CardRevealProfile,
): CardRevealAudioController {
  if (!context) return silentController;
  const master = context.createGain();
  master.gain.setValueAtTime(0.58, context.currentTime);
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
  master.gain.setValueAtTime(0.62, context.currentTime);
  master.connect(context.destination);
  dock(context, master, profile, { atMs: 0, sound: "dock", strength });
  window.setTimeout(() => master.disconnect(), 600);
}
