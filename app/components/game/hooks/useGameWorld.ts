import { useCallback, useEffect, useRef, useState } from "react";
import type { GameWorld } from "../../../game/game-world";
import { readWorldPreference, writeWorldPreference } from "../../../game/world-preference";
import { loadWorld, type WorldScene } from "../world-scenes";

export function useGameWorld() {
  const lifecycle = useRef(0);
  const navigation = useRef(0);
  const preferenceWrite = useRef(false);
  const preferenceRevision = useRef(0);
  const [scene, setScene] = useState<WorldScene | null>(null);
  const [defaultWorld, setDefaultWorld] = useState<GameWorld>("tttp");
  const [request, setRequest] = useState<{ target: GameWorld; generation: number } | null>(null);
  const [failed, setFailed] = useState(false);
  const [preferenceFailed, setPreferenceFailed] = useState(false);
  const [preferencePending, setPreferencePending] = useState(false);
  const switchWorld = useCallback((target: GameWorld) => {
    navigation.current++;
    setFailed(false);
    setRequest((current) => ({ target, generation: (current?.generation ?? 0) + 1 }));
  }, []);

  useEffect(() => {
    const owner = ++lifecycle.current;
    const initialNavigation = navigation.current;
    const initialPreference = preferenceRevision.current;
    const restore = async () => {
      let saved: GameWorld = "tttp";
      try { saved = await readWorldPreference(); }
      catch { if (lifecycle.current === owner && preferenceRevision.current === initialPreference) setPreferenceFailed(true); }
      if (lifecycle.current !== owner) return;
      if (preferenceRevision.current === initialPreference) setDefaultWorld(saved);
      if (navigation.current === initialNavigation) switchWorld(saved);
    };
    const timer = window.setTimeout(() => { void restore(); }, 0);
    return () => { lifecycle.current = owner + 1; window.clearTimeout(timer); };
  }, [switchWorld]);

  useEffect(() => {
    if (!request) return;
    let cancelled = false;
    let timer: number | undefined;
    const animation = new Promise<void>((resolve) => {
      timer = window.setTimeout(() => { timer = undefined; resolve(); }, window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 550);
    });
    void Promise.all([loadWorld(request.target), animation]).then(([next]) => {
      if (cancelled) return;
      setScene(next);
      setRequest(null);
    }).catch(() => { if (!cancelled) setFailed(true); });
    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [request]);

  const makeDefault = () => {
    if (!scene || preferenceWrite.current) return;
    const owner = lifecycle.current;
    const target = scene.world;
    preferenceWrite.current = true;
    setPreferencePending(true);
    void writeWorldPreference(target).then(() => {
      if (lifecycle.current !== owner) return;
      preferenceRevision.current++;
      setDefaultWorld(target);
      setPreferenceFailed(false);
    }).catch(() => {
      if (lifecycle.current === owner) setPreferenceFailed(true);
    }).finally(() => {
      preferenceWrite.current = false;
      if (lifecycle.current === owner) setPreferencePending(false);
    });
  };

  return {
    scene, defaultWorld, preferenceFailed, preferencePending, makeDefault, switchWorld, failed,
    target: request?.target ?? scene?.world ?? defaultWorld,
    loading: !scene || request !== null && !failed,
    retry: () => switchWorld(request?.target ?? defaultWorld),
    cancel: () => { setRequest(null); setFailed(false); },
  };
}
