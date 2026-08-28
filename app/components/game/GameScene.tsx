import type { PointerEvent, RefObject } from "react";
import type { CardKind } from "../../game/cards";
import type { GameState, Player } from "../../game/engine";
import type { RoguelikeRun } from "../../game/roguelike";
import { RulesModal } from "../game/RulesModal";
import { PauseModal, ResultModal, TurnBanner } from "./GameOverlays";
import { GameBoard, GameControls, GameHand, HealthBar, PauseButton } from "./GameHud";
import { RoguelikeOverlay } from "./RoguelikeOverlays";
import type { DamageFlight, DragState, GameMode } from "./types";

type GameSceneProps = {
  mode: GameMode;
  game: GameState;
  networkIntentPending: boolean;
  opponentLeft: boolean;
  isHumanTurn: boolean;
  topPlayer: Player;
  bottomPlayer: Player;
  displayedPlayer: Player;
  visibleMana: number;
  drag: DragState | null;
  damageFlights: DamageFlight[];
  turnBanner: Player | null;
  pauseOpen: boolean;
  rulesOpen: boolean;
  status: string;
  roguelike: RoguelikeRun | null;
  boardRef: RefObject<HTMLDivElement | null>;
  setCellRef: (index: number, node: HTMLButtonElement | null) => void;
  setHealthRef: (player: Player, node: HTMLDivElement | null) => void;
  remainingHealth: (player: Player) => number;
  canTarget: (cardId: string, index: number) => boolean;
  onCardDown: (event: PointerEvent<HTMLButtonElement>, cardId: string) => void;
  onCardMove: (event: PointerEvent<HTMLButtonElement>, cardId: string) => void;
  onCardUp: (event: PointerEvent<HTMLButtonElement>, cardId: string) => void;
  onCardCancel: (cardId: string) => void;
  onPause: () => void;
  onResume: () => void;
  onMenu: () => void;
  onEndTurn: () => void;
  onContinue: () => void;
  onChooseMana: () => void;
  onOpenCards: () => void;
  onChooseReward: (kind: CardKind) => void;
  onReplace: (index: number) => void;
  onRestartDraw: () => void;
  onCloseRules: () => void;
};

export function GameScene(props: GameSceneProps) {
  const { game } = props;
  const resultContext = props.mode === "roguelike" ? "roguelike" : "match";
  const showsRoundResult = props.mode !== "roguelike" || props.roguelike?.status === "playing";
  return (
    <main className={`unity-game-shell turn-${game.turn} ${props.isHumanTurn ? "" : "opponent-turn"} ${props.drag ? "card-is-dragging" : ""}`}>
      <section className="unity-game-stage">
        <PauseButton onClick={props.onPause} />
        <HealthBar game={game} player={props.topPlayer} placement="enemy" remaining={props.remainingHealth(props.topPlayer)} trackRef={(node) => props.setHealthRef(props.topPlayer, node)} />
        <GameBoard game={game} drag={props.drag} boardRef={props.boardRef} setCellRef={props.setCellRef} canTarget={props.canTarget} flights={props.damageFlights} />
        <HealthBar game={game} player={props.bottomPlayer} placement="player" remaining={props.remainingHealth(props.bottomPlayer)} trackRef={(node) => props.setHealthRef(props.bottomPlayer, node)} />
        <GameControls game={game} visibleMana={props.visibleMana} disabled={!props.isHumanTurn || props.networkIntentPending} onEndTurn={props.onEndTurn} />
        <GameHand game={game} player={props.displayedPlayer} disabled={!props.isHumanTurn || props.networkIntentPending} drag={props.drag} onPointerDown={props.onCardDown} onPointerMove={props.onCardMove} onPointerUp={props.onCardUp} onPointerCancel={props.onCardCancel} />
        <TurnBanner player={props.turnBanner} turn={game.turn} />
      </section>

      {showsRoundResult && <ResultModal autoAdvance={props.mode === "online" && game.phase === "round-over"} continueAvailable={!props.opponentLeft} game={game} context={resultContext} status={props.status} viewer={props.mode === "local" ? null : props.displayedPlayer} onContinue={props.onContinue} onMenu={props.onMenu} />}
      {props.mode === "roguelike" && props.roguelike && (
        <RoguelikeOverlay
          run={props.roguelike}
          onChooseMana={props.onChooseMana}
          onOpenCards={props.onOpenCards}
          onChooseReward={props.onChooseReward}
          onReplace={props.onReplace}
          onRestartDraw={props.onRestartDraw}
          onMenu={props.onMenu}
        />
      )}
      <PauseModal open={props.pauseOpen} onResume={props.onResume} onMenu={props.onMenu} />
      <RulesModal open={props.rulesOpen} onClose={props.onCloseRules} />
    </main>
  );
}
