import { createContext, useContext, type ReactNode } from "react";
import { useAppActivity } from "./hooks/useAppActivity";
import { useGameAudio } from "./hooks/useGameAudio";
import { usePlayerCollection } from "./hooks/usePlayerCollection";

type GameSession = {
  active: boolean;
  audio: ReturnType<typeof useGameAudio>;
  collection: ReturnType<typeof usePlayerCollection>;
};

const GameSessionContext = createContext<GameSession | null>(null);

export function GameSessionProvider({ children }: { children: ReactNode }) {
  const active = useAppActivity();
  const audio = useGameAudio(active);
  const collection = usePlayerCollection(audio.playSfx);
  return <GameSessionContext.Provider value={{ active, audio, collection }}>{children}</GameSessionContext.Provider>;
}

export function useGameSession() {
  const session = useContext(GameSessionContext);
  if (!session) throw new Error("GameSessionProvider is missing");
  return session;
}
