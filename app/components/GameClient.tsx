"use client";

import { useEffect, useRef, useState } from "react";
import {
  createGame,
  endTurn,
  playCard,
  startNextRound,
  type Player,
} from "../game/engine";
import {
  canTargetCard,
  getGamePlayers,
  getGameStatus,
  isHumanGameTurn,
  remainingHealth,
} from "../game/game-presentation";
import {
  chooseCardReward,
  chooseManaReward,
  createRoguelikeGame,
  createRoguelikeRun,
  getRoguelikeStage,
  openCardReward,
  replaceRoguelikeCard,
  restartDrawnStage,
  type RoguelikeRun,
} from "../game/roguelike";
import { DeckScreen } from "./game/DeckScreen";
import { GameScene } from "./game/GameScene";
import { MatchmakingScreen } from "./game/MatchmakingScreen";
import { MenuScreen } from "./game/MenuScreen";
import { SettingsScreen } from "./game/SettingsScreen";
import { StoreScreen } from "./game/StoreScreen";
import type { GameMode } from "./game/types";
import { useDamageSequence } from "./game/hooks/useDamageSequence";
import { useCardDrag } from "./game/hooks/useCardDrag";
import { useGameAudio } from "./game/hooks/useGameAudio";
import { usePlayerCollection } from "./game/hooks/usePlayerCollection";
import { useScenePattern } from "./game/hooks/useScenePattern";
import { useGamePhaseEffects } from "./game/hooks/useGamePhaseEffects";
import { useOpponentTurns } from "./game/hooks/useOpponentTurns";
import { usePhotonGame } from "./game/hooks/usePhotonGame";
import { useTurnBanner } from "./game/hooks/useTurnBanner";
import { useLocalization } from "../game/localization";
import type { CardKind } from "../game/cards";
import { isPhotonConfigured, PHOTON_GAME_CONFIG } from "../game/photon-config";

export function GameClient() {
  useScenePattern();
  const { action, t } = useLocalization();
  const { muted, setMuted, playSfx, playRevealDock, setAmbientSuspended, startCardRevealAudio } = useGameAudio();
  const collection = usePlayerCollection(playSfx);
  const [screen, setScreen] = useState<"menu" | "collection" | "settings" | "store" | "matchmaking" | "game">("menu");
  const [deckFocusKind, setDeckFocusKind] = useState<CardKind | null>(null);
  const [mode, setMode] = useState<GameMode>("local");
  const [game, setGame] = useState(createGame);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [pauseOpen, setPauseOpen] = useState(false);
  const [roguelike, setRoguelike] = useState<RoguelikeRun | null>(null);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const previousTurnRef = useRef<Player>(game.turn);
  const {
    hide: hideTurnBanner,
    player: turnBanner,
    show: showTurnBanner,
  } = useTurnBanner(1);
  const online = usePhotonGame(game, mode, setGame);
  const { intentPending: networkIntentPending, network } = online;
  const damage = useDamageSequence(game, mode, network.side, setGame, playSfx);

  useGamePhaseEffects({
    game,
    mode,
    networkSide: network.side,
    playSfx,
    roguelike,
    setGame,
    setRoguelike,
  });

  useOpponentTurns({
    game,
    mode,
    pauseOpen,
    playSfx,
    roguelike,
    screen,
    setGame,
    setRoguelike,
  });

  useEffect(() => {
    document.body.dataset.gameScreen = screen;
    return () => {
      delete document.body.dataset.gameScreen;
    };
  }, [screen]);

  useEffect(() => {
    if (screen !== "matchmaking" || network.phase !== "ready") return;
    const timeout = window.setTimeout(() => {
      previousTurnRef.current = game.turn;
      showTurnBanner(game.turn);
      setScreen("game");
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [game.turn, network.phase, screen, showTurnBanner]);

  const isHumanTurn = isHumanGameTurn(mode, game, network);
  const { bottomPlayer, displayedPlayer, topPlayer } = getGamePlayers(mode, game.turn, network.side);
  const status = getGameStatus(game, t, action);

  const canCardTargetCell = (cardId: string, index: number) => {
    return canTargetCard(game, cardId, index, isHumanTurn && !networkIntentPending);
  };

  const playCardFromHand = (cardId: string, targetIndex?: number) => {
    const card = game.hands[game.turn].find((item) => item.id === cardId);
    if (card && (card.kind === "place" || card.kind === "place-draw")) {
      playSfx("placeFill", 0.32);
      window.setTimeout(() => playSfx("placeScale", 0.52), 70);
    } else {
      playSfx("click", 0.38);
    }
    if (mode === "online" && network.side === 2) {
      online.sendIntent({
        type: "play",
        cardId,
        targetIndex,
      });
      return;
    }
    setGame((current) => playCard(current, cardId, targetIndex));
    if (mode === "roguelike" && roguelike) {
      setRoguelike({
        ...roguelike,
        cardsPlayed: roguelike.cardsPlayed + 1,
        playerFiguresPlaced:
          roguelike.playerFiguresPlaced +
          (card?.kind === "place" || card?.kind === "place-draw" ? 1 : 0),
      });
    }
  };

  const cardDrag = useCardDrag(
    game,
    isHumanTurn && !networkIntentPending,
    boardRef,
    canCardTargetCell,
    playCardFromHand,
    playSfx,
  );
  const clearDrag = cardDrag.clearDrag;

  useEffect(() => {
    if (screen !== "game" || previousTurnRef.current === game.turn) return;
    previousTurnRef.current = game.turn;
    clearDrag();
    showTurnBanner(game.turn);
  }, [clearDrag, game.turn, screen, showTurnBanner]);

  const startGame = (nextMode: GameMode) => {
    playSfx("click", 0.38);
    const nextRun = nextMode === "roguelike" ? createRoguelikeRun() : null;
    const next = nextRun
      ? createRoguelikeGame(nextRun)
      : createGame(collection.selectedKinds);
    setMode(nextMode);
    setRoguelike(nextRun);
    setGame(next);
    previousTurnRef.current = next.turn;
    showTurnBanner(next.turn);
    setPauseOpen(false);
    setScreen("game");
  };

  const startOnlineGame = () => {
    if (!isPhotonConfigured(PHOTON_GAME_CONFIG)) return;
    playSfx("click", 0.38);
    const next = createGame(collection.selectedKinds);
    setMode("online");
    setGame(next);
    previousTurnRef.current = next.turn;
    hideTurnBanner();
    setPauseOpen(false);
    setScreen("matchmaking");
    void online.connect(PHOTON_GAME_CONFIG);
  };

  const startBotFromMatchmaking = () => {
    online.disconnect();
    startGame("bot");
  };

  const leaveToMenu = () => {
    playSfx("click", 0.38);
    online.disconnect();
    clearDrag();
    damage.clearFlights();
    hideTurnBanner();
    setPauseOpen(false);
    setRulesOpen(false);
    setRoguelike(null);
    setScreen("menu");
  };

  const continueAfterResult = () => {
    playSfx("click", 0.38);
    if (mode === "online" && network.side === 2) {
      online.sendIntent({ type: "next-round" });
      return;
    }
    const next = game.phase === "game-over" ? createGame(game.deckKinds) : startNextRound(game);
    previousTurnRef.current = next.turn;
    showTurnBanner(next.turn);
    setGame(next);
  };

  const finishTurn = () => {
    playSfx("click", 0.38);
    if (mode === "online" && network.side === 2) {
      online.sendIntent({ type: "end-turn" });
      return;
    }
    setGame((current) => endTurn(current));
    if (mode === "roguelike" && roguelike) {
      const stage = getRoguelikeStage(roguelike.stageIndex);
      setRoguelike({
        ...roguelike,
        enemyMovesRemaining: stage.smartFigures + stage.randomFigures,
      });
    }
  };

  const startRoguelikeStage = (nextRun: RoguelikeRun) => {
    setRoguelike(nextRun);
    const next = createRoguelikeGame(nextRun);
    previousTurnRef.current = next.turn;
    showTurnBanner(next.turn);
    setGame(next);
  };

  if (screen === "collection") {
    return (
      <DeckScreen
        focusKind={deckFocusKind}
        selectedKinds={collection.selectedKinds}
        unlockedKinds={collection.unlockedKinds}
        onBack={() => setScreen("menu")}
        onToggle={collection.toggleCard}
        onSave={() => {
          collection.saveDeck();
          setScreen("menu");
        }}
      />
    );
  }

  if (screen === "settings") {
    return (
      <SettingsScreen
        coins={collection.coins}
        muted={muted}
        playerName={collection.profileName}
        testCoinGrant={collection.testCoinGrant}
        onAddCoins={collection.addTestCoins}
        onBack={() => setScreen("menu")}
        onNameChange={collection.changeName}
        onResetCards={collection.resetCards}
        onToggleSound={() => {
          playSfx("click", 0.38);
          setMuted((current) => !current);
        }}
      />
    );
  }

  if (screen === "store") {
    return (
      <StoreScreen
        coins={collection.coins}
        lockedKinds={collection.lockedKinds}
        purchasedKinds={collection.purchasedKinds}
        selectedKinds={collection.selectedKinds}
        unlockedKinds={collection.unlockedKinds}
        onAmbientSuspendedChange={setAmbientSuspended}
        onBack={() => {
          collection.setPurchasedKinds([]);
          setScreen("menu");
        }}
        onBuy={collection.buyCards}
        onCompleteReveal={(lastKind) => {
          collection.setPurchasedKinds([]);
          setDeckFocusKind(lastKind);
          setScreen("collection");
        }}
        playDock={playRevealDock}
        startRevealAudio={startCardRevealAudio}
      />
    );
  }

  if (screen === "menu") {
    return (
      <MenuScreen
        coins={collection.coins}
        photonAvailable={isPhotonConfigured(PHOTON_GAME_CONFIG)}
        rulesOpen={rulesOpen}
        onStart={startGame}
        onStartOnline={startOnlineGame}
        onDeck={() => {
          playSfx("click", 0.38);
          setDeckFocusKind(null);
          setScreen("collection");
        }}
        onStore={() => {
          playSfx("click", 0.38);
          setScreen("store");
        }}
        onSettings={() => {
          playSfx("click", 0.38);
          setScreen("settings");
        }}
        onOpenRules={() => {
          playSfx("click", 0.38);
          setRulesOpen(true);
        }}
        onCloseRules={() => setRulesOpen(false)}
      />
    );
  }

  if (screen === "matchmaking") {
    return (
      <MatchmakingScreen
        network={network}
        onBot={startBotFromMatchmaking}
        onMenu={leaveToMenu}
      />
    );
  }

  return (
    <GameScene
      mode={mode}
      game={game}
      networkIntentPending={networkIntentPending}
      isHumanTurn={isHumanTurn}
      topPlayer={topPlayer}
      bottomPlayer={bottomPlayer}
      displayedPlayer={displayedPlayer}
      drag={cardDrag.drag}
      damageFlights={damage.flights}
      turnBanner={turnBanner}
      pauseOpen={pauseOpen}
      rulesOpen={rulesOpen}
      status={status}
      roguelike={roguelike}
      boardRef={boardRef}
      setCellRef={damage.setCellRef}
      setHealthRef={damage.setHealthRef}
      remainingHealth={(player) => remainingHealth(game, player, damage.previewDamage)}
      canTarget={canCardTargetCell}
      onCardDown={cardDrag.begin}
      onCardMove={cardDrag.move}
      onCardUp={cardDrag.finish}
      onCardCancel={cardDrag.cancel}
      onPause={() => setPauseOpen(true)}
      onResume={() => setPauseOpen(false)}
      onMenu={leaveToMenu}
      onEndTurn={finishTurn}
      onContinue={continueAfterResult}
      onChooseMana={() => roguelike && startRoguelikeStage(chooseManaReward(roguelike))}
      onOpenCards={() => roguelike && setRoguelike(openCardReward(roguelike))}
      onChooseReward={(kind) => {
        if (!roguelike) return;
        const next = chooseCardReward(roguelike, kind);
        if (next.status === "playing") startRoguelikeStage(next);
        else setRoguelike(next);
      }}
      onReplace={(index) => roguelike && startRoguelikeStage(replaceRoguelikeCard(roguelike, index))}
      onRestartDraw={() => roguelike && startRoguelikeStage(restartDrawnStage(roguelike))}
      onCloseRules={() => setRulesOpen(false)}
    />
  );
}
