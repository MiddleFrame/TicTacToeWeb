import { useCallback, useEffect, useRef, useState } from "react";
import type { Player } from "../../../game/engine";

export function useTurnBanner(initialPlayer: Player | null = null) {
  const [player, setPlayer] = useState<Player | null>(initialPlayer);
  const timeoutRef = useRef<number | null>(null);

  const hide = useCallback(() => {
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
    setPlayer(null);
  }, []);

  const show = useCallback((nextPlayer: Player) => {
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    setPlayer(nextPlayer);
    timeoutRef.current = window.setTimeout(() => {
      timeoutRef.current = null;
      setPlayer(null);
    }, 760);
  }, []);

  useEffect(() => hide, [hide]);

  return { hide, player, show };
}
