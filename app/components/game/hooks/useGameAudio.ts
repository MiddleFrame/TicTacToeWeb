import { useCallback, useEffect, useRef, useState } from "react";

const paths = {
  click: ["/game/audio/ui-click-01.ogg", "/game/audio/ui-click-02.ogg"],
  placeFill: ["/game/audio/figure-fill-01.ogg", "/game/audio/figure-fill-02.ogg"],
  placeScale: ["/game/audio/figure-scale-01.ogg", "/game/audio/figure-scale-02.ogg"],
  erase: ["/game/audio/damage-erase-01.ogg", "/game/audio/damage-erase-02.ogg"],
  impact: ["/game/audio/damage-impact-01.ogg", "/game/audio/damage-impact-02.ogg", "/game/audio/damage-impact-03.ogg"],
} as const;

export type SoundKind = keyof typeof paths;
export type PlaySound = (kind: SoundKind, volume?: number) => void;

export function useGameAudio() {
  const [muted, setMuted] = useState(false);
  const musicRef = useRef<HTMLAudioElement | null>(null);
  const mutedRef = useRef(false);

  const playSfx = useCallback<PlaySound>((kind, volume = 1) => {
    if (mutedRef.current) return;
    const variants = paths[kind];
    const audio = new Audio(variants[Math.floor(Math.random() * variants.length)]);
    audio.volume = Math.min(1, volume);
    audio.playbackRate = 0.97 + Math.random() * 0.06;
    void audio.play().catch(() => undefined);
  }, []);

  useEffect(() => {
    const savedMuted = window.localStorage.getItem("tttp-muted") === "1";
    mutedRef.current = savedMuted;
    const restore = window.setTimeout(() => setMuted(savedMuted), 0);
    const music = new Audio("/game/audio/minimal-background-loop.ogg");
    music.loop = true;
    music.volume = savedMuted ? 0 : 0.24;
    musicRef.current = music;
    const unlock = () => {
      if (!mutedRef.current) void music.play().catch(() => undefined);
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    return () => {
      window.clearTimeout(restore);
      window.removeEventListener("pointerdown", unlock);
      music.pause();
      musicRef.current = null;
    };
  }, []);

  useEffect(() => {
    mutedRef.current = muted;
    window.localStorage.setItem("tttp-muted", muted ? "1" : "0");
    const music = musicRef.current;
    if (!music) return;
    music.volume = muted ? 0 : 0.24;
    if (muted) music.pause();
    else void music.play().catch(() => undefined);
  }, [muted]);

  return { muted, setMuted, playSfx };
}
