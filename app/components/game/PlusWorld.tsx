import { GameRuntime } from "../GameRuntime";
import { GameNavigation } from "./GameNavigation";
import { RoundExperience } from "./RoundExperience";
import { useGameSession } from "./GameSessionProvider";
import type { WorldSceneProps } from "./WorldControls";

export function PlusWorld({ worldControls }: WorldSceneProps) {
  const { active, audio, collection } = useGameSession();
  return <GameRuntime roguelite={false} active={active} audio={audio} selectedKinds={collection.selectedKinds}
    recordRound={collection.progression.recordRound}
    renderExperience={(result, forfeit, draw) => <RoundExperience result={result} progression={collection.progression} forfeit={forfeit} draw={draw} />}
    renderNavigation={(navigation) => <GameNavigation {...navigation} audio={audio} collection={collection} worldControls={worldControls} />}
  />;
}
