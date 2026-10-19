import { useCallback, useEffect, useState } from "react";
import { gameWorld, type GameWorld } from "../../../game/game-world";
import { loadWorld, type WorldScene } from "../world-scenes";

const DEFAULT_WORLD_KEY = "tttp-default-world-v1";

export function useGameWorld() {
  const [scene, setScene] = useState<WorldScene | null>(null);
  const [defaultWorld, setDefaultWorld] = useState<GameWorld>("tttp");
  const [request, setRequest] = useState<{ target: GameWorld; generation: number } | null>(null);
  const [failed, setFailed] = useState(false);
  const [preferenceFailed, setPreferenceFailed] = useState(false);
  const switchWorld = useCallback((target: GameWorld) => {
    setFailed(false);
    setRequest((current) => ({ target, generation: (current?.generation ?? 0) + 1 }));
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      let saved: GameWorld = "tttp";
      try { saved = gameWorld(window.localStorage.getItem(DEFAULT_WORLD_KEY)); }
      catch { setPreferenceFailed(true); }
      setDefaultWorld(saved);
      switchWorld(saved);
    }, 0);
    return () => window.clearTimeout(timer);
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
    if (!scene) return;
    try {
      window.localStorage.setItem(DEFAULT_WORLD_KEY, scene.world);
      setDefaultWorld(scene.world);
      setPreferenceFailed(false);
    } catch { setPreferenceFailed(true); }
  };

  return {
    scene, defaultWorld, preferenceFailed, makeDefault, switchWorld, failed,
    target: request?.target ?? scene?.world ?? defaultWorld,
    loading: !scene || request !== null && !failed,
    retry: () => switchWorld(request?.target ?? defaultWorld),
    cancel: () => { setRequest(null); setFailed(false); },
  };
}
