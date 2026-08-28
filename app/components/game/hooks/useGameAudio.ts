import { useCallback, useEffect, useRef, useState } from "react";
import { createCardRevealSoundscape, playCardDock, type CardRevealAudioController } from "../../../game/card-reveal-audio";
import { cardRevealProfile, type CardRevealProfile } from "../../../game/card-reveal-profile";
import type { CardKind } from "../../../game/cards";

const paths = {
  click: ["/game/audio/ui-click-01.ogg", "/game/audio/ui-click-02.ogg"],
  placeFill: ["/game/audio/figure-fill-01.ogg", "/game/audio/figure-fill-02.ogg"],
  placeScale: ["/game/audio/figure-scale-01.ogg", "/game/audio/figure-scale-02.ogg"],
  erase: ["/game/audio/damage-erase-01.ogg", "/game/audio/damage-erase-02.ogg"],
  impact: ["/game/audio/damage-impact-01.ogg", "/game/audio/damage-impact-02.ogg", "/game/audio/damage-impact-03.ogg"],
} as const;

export type SoundKind = keyof typeof paths;
export type PlaySound = (kind: SoundKind, volume?: number) => void;
export type StartCardRevealAudio = (profile: CardRevealProfile) => CardRevealAudioController;
export type PlayCardDock = (kind: CardKind, strength?: number) => void;

export function useGameAudio(appActive = true) {
  const [muted, setMuted] = useState(false);
  const [ambientSuspended, setAmbientSuspendedState] = useState(false);
  const musicRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sfxRef = useRef(new Set<HTMLAudioElement>());
  const appActiveRef = useRef(appActive);
  const mutedRef = useRef(false);
  const ambientSuspendedRef = useRef(false);

  const playSfx = useCallback<PlaySound>((kind, volume = 1) => {
    if (mutedRef.current || !appActiveRef.current) return;
    const variants = paths[kind];
    const audio = new Audio(variants[Math.floor(Math.random() * variants.length)]);
    const release = () => sfxRef.current.delete(audio);
    audio.volume = Math.min(1, volume);
    audio.playbackRate = 0.97 + Math.random() * 0.06;
    audio.addEventListener("ended", release, { once: true });
    audio.addEventListener("error", release, { once: true });
    sfxRef.current.add(audio);
    void audio.play().catch(release);
  }, []);

  const startCardRevealAudio = useCallback<StartCardRevealAudio>((profile) => {
    if (mutedRef.current || !appActiveRef.current) return createCardRevealSoundscape(null, profile);
    const context = audioContextRef.current ?? new AudioContext();
    audioContextRef.current = context;
    void context.resume().catch(() => undefined);
    return createCardRevealSoundscape(context, profile);
  }, []);

  const setAmbientSuspended = useCallback((suspended: boolean) => {
    ambientSuspendedRef.current = suspended;
    setAmbientSuspendedState(suspended);
    if (!suspended) return;
    const music = musicRef.current;
    if (!music) return;
    music.volume = 0;
    music.pause();
  }, []);

  const playRevealDock = useCallback<PlayCardDock>((kind, strength = 1) => {
    if (mutedRef.current || !appActiveRef.current) return;
    const context = audioContextRef.current ?? new AudioContext();
    audioContextRef.current = context;
    void context.resume().catch(() => undefined);
    playCardDock(context, cardRevealProfile(kind), strength);
  }, []);

  useEffect(() => {
    const activeSfx = sfxRef.current;
    const savedMuted = window.localStorage.getItem("tttp-muted") === "1";
    mutedRef.current = savedMuted;
    const restore = window.setTimeout(() => setMuted(savedMuted), 0);
    const music = new Audio("/game/audio/minimal-background-loop.ogg");
    music.loop = true;
    music.volume = savedMuted ? 0 : 0.24;
    musicRef.current = music;
    const unlock = () => {
      const context = audioContextRef.current ?? new AudioContext();
      audioContextRef.current = context;
      void context.resume().catch(() => undefined);
      if (
        document.visibilityState !== "hidden"
        && document.hasFocus()
        && !mutedRef.current
        && !ambientSuspendedRef.current
      ) void music.play().catch(() => undefined);
    };
    const pausePlayback = () => {
      music.volume = 0;
      music.pause();
      activeSfx.forEach((audio) => audio.pause());
      activeSfx.clear();
      void audioContextRef.current?.suspend().catch(() => undefined);
    };
    const resumePlayback = () => {
      if (
        document.visibilityState === "hidden"
        || !document.hasFocus()
        || mutedRef.current
        || ambientSuspendedRef.current
      ) return;
      music.volume = 0.24;
      void audioContextRef.current?.resume().catch(() => undefined);
      void music.play().catch(() => undefined);
    };
    const syncPageAudio = () => {
      if (document.visibilityState === "hidden" || !document.hasFocus()) pausePlayback();
      else resumePlayback();
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    document.addEventListener("visibilitychange", syncPageAudio);
    window.addEventListener("blur", pausePlayback);
    window.addEventListener("focus", resumePlayback);
    window.addEventListener("pagehide", pausePlayback);
    window.addEventListener("pageshow", resumePlayback);
    return () => {
      window.clearTimeout(restore);
      window.removeEventListener("pointerdown", unlock);
      document.removeEventListener("visibilitychange", syncPageAudio);
      window.removeEventListener("blur", pausePlayback);
      window.removeEventListener("focus", resumePlayback);
      window.removeEventListener("pagehide", pausePlayback);
      window.removeEventListener("pageshow", resumePlayback);
      music.pause();
      musicRef.current = null;
      activeSfx.forEach((audio) => audio.pause());
      activeSfx.clear();
      const context = audioContextRef.current;
      audioContextRef.current = null;
      if (context) void context.close().catch(() => undefined);
    };
  }, []);

  useEffect(() => {
    appActiveRef.current = appActive;
    mutedRef.current = muted;
    ambientSuspendedRef.current = ambientSuspended;
    window.localStorage.setItem("tttp-muted", muted ? "1" : "0");
    const music = musicRef.current;
    const suspended = muted || ambientSuspended || !appActive;
    if (suspended) {
      sfxRef.current.forEach((audio) => audio.pause());
      sfxRef.current.clear();
      void audioContextRef.current?.suspend().catch(() => undefined);
    } else {
      void audioContextRef.current?.resume().catch(() => undefined);
    }
    if (!music) return;
    music.volume = suspended ? 0 : 0.24;
    if (suspended) music.pause();
    else void music.play().catch(() => undefined);
  }, [ambientSuspended, appActive, muted]);

  return { muted, setMuted, playSfx, playRevealDock, setAmbientSuspended, startCardRevealAudio };
}
