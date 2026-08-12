"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CARD_DEFINITIONS } from "../game/cards";
import {
  cardCost,
  createGame,
  endTurn,
  placeFigure,
  playCard,
  rechangeRandomCard,
  settleThaw,
  startNextRound,
  type Player,
} from "../game/engine";
import {
  chooseCardReward,
  chooseManaReward,
  createRoguelikeGame,
  createRoguelikeRun,
  getRoguelikeStage,
  openCardReward,
  replaceRoguelikeCard,
  resolveRoguelikeResult,
  restartDrawnStage,
  type RoguelikeRun,
} from "../game/roguelike";
import {
  applyNetworkIntent,
  PhotonGameSession,
  type NetworkIntent,
  type PhotonSnapshot,
} from "../game/photon";
import { DeckScreen } from "./game/DeckScreen";
import { GameScene } from "./game/GameScene";
import { MenuScreen } from "./game/MenuScreen";
import { SettingsScreen } from "./game/SettingsScreen";
import { StoreScreen } from "./game/StoreScreen";
import type { GameMode } from "./game/types";
import { useDamageSequence } from "./game/hooks/useDamageSequence";
import { useCardDrag } from "./game/hooks/useCardDrag";
import { useGameAudio } from "./game/hooks/useGameAudio";
import { usePlayerCollection } from "./game/hooks/usePlayerCollection";
import { useLocalization } from "../game/localization";
import { chooseBotCard, chooseBotCardTarget, chooseBotTarget } from "../game/bot-player";

const PHOTON_APP_ID = process.env.NEXT_PUBLIC_PHOTON_APP_ID ?? "";
const INITIAL_NETWORK: PhotonSnapshot = {
  phase: "idle",
  side: null,
  roomName: "",
  playerCount: 0,
  error: "",
};
export function GameClient() {
  const { action, t } = useLocalization();
  const { muted, setMuted, playSfx } = useGameAudio();
  const collection = usePlayerCollection(playSfx);
  const [screen, setScreen] = useState<"menu" | "collection" | "settings" | "store" | "game">("menu");
  const [mode, setMode] = useState<GameMode>("local");
  const [network, setNetwork] = useState<PhotonSnapshot>(INITIAL_NETWORK);
  const [networkIntentPending, setNetworkIntentPending] = useState(false);
  const [game, setGame] = useState(createGame);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [pauseOpen, setPauseOpen] = useState(false);
  const [turnBanner, setTurnBanner] = useState<Player | null>(1);
  const [roguelike, setRoguelike] = useState<RoguelikeRun | null>(null);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const previousTurnRef = useRef<Player>(game.turn);
  const photonSession = useRef<PhotonGameSession | null>(null);
  if (photonSession.current === null) {
    photonSession.current = new PhotonGameSession({
      onSnapshot: () => undefined,
      onState: () => undefined,
      onIntent: () => undefined,
    });
  }
  const damage = useDamageSequence(game, mode, network.side, setGame, playSfx);

  useEffect(() => {
    document.body.dataset.gameScreen = screen;
    return () => {
      delete document.body.dataset.gameScreen;
    };
  }, [screen]);

  useEffect(() => {
    if (
      mode !== "roguelike" ||
      game.phase !== "game-over" ||
      !roguelike ||
      roguelike.status !== "playing"
    ) {
      return;
    }
    const timeout = window.setTimeout(
      () => setRoguelike(resolveRoguelikeResult(roguelike, game.gameWinner)),
      0,
    );
    return () => window.clearTimeout(timeout);
  }, [game.gameWinner, game.phase, mode, roguelike]);

  useEffect(() => {
    if (game.phase !== "thawing") return;
    const canSettle = mode !== "online" || network.side === 1;
    const revealTimeout = window.setTimeout(
      () => playSfx("placeScale", 0.46),
      390,
    );
    const settleTimeout = window.setTimeout(() => {
      if (canSettle) {
        setGame((current) => settleThaw(current));
      }
    }, 760);
    return () => {
      window.clearTimeout(revealTimeout);
      window.clearTimeout(settleTimeout);
    };
  }, [game.phase, game.thawingCells, mode, network.side, playSfx]);

  useEffect(() => {
    if (!networkIntentPending) return;
    const timeout = window.setTimeout(
      () => setNetworkIntentPending(false),
      4000,
    );
    return () => window.clearTimeout(timeout);
  }, [networkIntentPending]);

  useEffect(() => {
    const session = photonSession.current;
    if (!session) return;
    session.updateCallbacks({
      onSnapshot: (snapshot) => {
        setNetwork(snapshot);
        if (snapshot.phase !== "ready") setNetworkIntentPending(false);
      },
      onState: (remoteState) => {
        setNetworkIntentPending(false);
        setGame(remoteState);
      },
      onIntent: (intent: NetworkIntent) => {
        if (network.side !== 1) return;
        setGame((current) => applyNetworkIntent(current, intent, 2));
      },
    });
  }, [network.side]);

  useEffect(() => {
    if (
      mode === "online" &&
      network.phase === "ready" &&
      network.side === 1
    ) {
      photonSession.current?.broadcastState(game);
    }
  }, [game, mode, network.phase, network.side]);

  useEffect(
    () => () => {
      photonSession.current?.disconnect();
    },
    [],
  );

  useEffect(() => {
    if (
      screen !== "game" ||
      pauseOpen ||
      mode !== "bot" ||
      game.turn !== 2 ||
      game.phase !== "playing"
    ) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setGame((current) => {
        if (
          current.turn !== 2 ||
          current.phase !== "playing" ||
          mode !== "bot"
        ) {
          return current;
        }
        if (current.cardsPlayedThisTurn >= 2) return endTurn(current);

        const target = chooseBotTarget(current);
        const playable = chooseBotCard(current, target);

        if (!playable) return endTurn(current);
        const cardTarget = chooseBotCardTarget(current, playable, target);
        const next = playCard(current, playable.id, cardTarget);
        return next === current ? endTurn(current) : next;
      });
    }, 560);
    return () => window.clearTimeout(timeout);
  }, [game, mode, pauseOpen, screen]);

  useEffect(() => {
    if (
      screen !== "game" ||
      pauseOpen ||
      mode !== "roguelike" ||
      !roguelike ||
      roguelike.status !== "playing" ||
      game.turn !== 2 ||
      game.phase !== "playing"
    ) {
      return;
    }

    const timeout = window.setTimeout(() => {
      if (roguelike.enemyMovesRemaining <= 0) {
        setGame((current) => endTurn(current));
        return;
      }
      const stage = getRoguelikeStage(roguelike.stageIndex);
      const useSmartMove = roguelike.enemyMovesRemaining > stage.randomFigures;
      const target = useSmartMove
        ? chooseBotTarget(game)
        : (() => {
            const available = game.board
              .map((cell, index) =>
                cell === null && !game.frozen[index] ? index : -1,
              )
              .filter((index) => index >= 0);
            return available.length > 0
              ? available[Math.floor(Math.random() * available.length)]
              : null;
          })();
      if (target === null) {
        setRoguelike({ ...roguelike, enemyMovesRemaining: 0 });
        setGame((current) => endTurn(current));
        return;
      }
      setGame((current) => placeFigure(current, target));
      setRoguelike({
        ...roguelike,
        enemyMovesRemaining: roguelike.enemyMovesRemaining - 1,
        enemyFiguresPlaced: roguelike.enemyFiguresPlaced + 1,
      });
      playSfx("placeScale", 0.48);
    }, 520);
    return () => window.clearTimeout(timeout);
  }, [game, mode, pauseOpen, playSfx, roguelike, screen]);

  const isHumanTurn =
    mode === "local" ||
    ((mode === "bot" || mode === "roguelike") && game.turn === 1) ||
    (mode === "online" &&
      network.phase === "ready" &&
      network.side === game.turn);
  const displayedPlayer: Player =
    mode === "local"
      ? game.turn
      : mode === "online"
        ? (network.side ?? 1)
        : 1;
  const topPlayer: Player = displayedPlayer === 1 ? 2 : 1;
  const bottomPlayer = displayedPlayer;
  const remainingHealth = (player: Player) =>
    Math.max(0, game.scoreToWin - game.scores[player === 1 ? 2 : 1] - damage.previewDamage[player]);

  const status = useMemo(() => {
    const sideName = (player: Player) => player === 1 ? t("crosses") : t("circles");
    if (game.phase === "thawing") return t("thawing");
    if (game.phase === "clearing") return `${t("line")}! +${game.lastGain}`;
    if (game.phase === "round-over") {
      return game.roundWinner
        ? `${t("wonRound")} ${sideName(game.roundWinner).toLowerCase()}`
        : t("roundDraw");
    }
    if (game.phase === "game-over") {
      return game.gameWinner
        ? `${sideName(game.gameWinner)} ${t("wonMatch")}`
        : t("matchDraw");
    }
    return action(game.lastAction);
  }, [action, game, t]);

  const canCardTargetCell = (cardId: string, index: number) => {
    if (
      !isHumanTurn ||
      networkIntentPending ||
      game.phase !== "playing" ||
      game.frozen[index]
    ) {
      return false;
    }
    const card = game.hands[game.turn].find((item) => item.id === cardId);
    if (!card || cardCost(game, card) > game.mana) return false;
    const definition = CARD_DEFINITIONS[card.kind];
    if (definition.target === "empty") return game.board[index] === null;
    if (definition.target === "ally") return game.board[index] === game.turn;
    return false;
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
      setNetworkIntentPending(true);
      photonSession.current?.sendIntent({
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
    setTurnBanner(game.turn);
    const timeout = window.setTimeout(() => setTurnBanner(null), 760);
    return () => window.clearTimeout(timeout);
  }, [clearDrag, game.turn, screen]);

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
    setTurnBanner(next.turn);
    setPauseOpen(false);
    window.setTimeout(() => setTurnBanner(null), 760);
    setNetworkIntentPending(false);
    setScreen("game");
  };

  const startOnlineGame = () => {
    if (!PHOTON_APP_ID) return;
    playSfx("click", 0.38);
    const next = createGame(collection.selectedKinds);
    setMode("online");
    setGame(next);
    previousTurnRef.current = next.turn;
    setTurnBanner(next.turn);
    setPauseOpen(false);
    window.setTimeout(() => setTurnBanner(null), 760);
    setNetworkIntentPending(false);
    setScreen("game");
    void photonSession.current?.connect(PHOTON_APP_ID);
  };

  const leaveToMenu = () => {
    playSfx("click", 0.38);
    photonSession.current?.disconnect();
    setNetwork(INITIAL_NETWORK);
    setNetworkIntentPending(false);
    clearDrag();
    damage.clearFlights();
    setTurnBanner(null);
    setPauseOpen(false);
    setRulesOpen(false);
    setRoguelike(null);
    setScreen("menu");
  };

  const continueAfterResult = () => {
    playSfx("click", 0.38);
    if (mode === "online" && network.side === 2) {
      setNetworkIntentPending(true);
      photonSession.current?.sendIntent({ type: "next-round" });
      return;
    }
    const next = game.phase === "game-over" ? createGame(game.deckKinds) : startNextRound(game);
    previousTurnRef.current = next.turn;
    setTurnBanner(next.turn);
    window.setTimeout(() => setTurnBanner(null), 760);
    setGame(next);
  };

  const rechangeCard = () => {
    playSfx("click", 0.38);
    if (mode === "online" && network.side === 2) {
      setNetworkIntentPending(true);
      photonSession.current?.sendIntent({ type: "rechange" });
      return;
    }
    setGame((current) => rechangeRandomCard(current));
  };

  const finishTurn = () => {
    playSfx("click", 0.38);
    if (mode === "online" && network.side === 2) {
      setNetworkIntentPending(true);
      photonSession.current?.sendIntent({ type: "end-turn" });
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
    setTurnBanner(next.turn);
    window.setTimeout(() => setTurnBanner(null), 760);
    setGame(next);
  };

  if (screen === "collection") {
    return (
      <DeckScreen
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
        muted={muted}
        playerName={collection.profileName}
        onBack={() => setScreen("menu")}
        onNameChange={collection.changeName}
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
        purchasedKind={collection.purchasedKind}
        onBack={() => {
          collection.setPurchasedKind(null);
          setScreen("menu");
        }}
        onBuy={collection.buyCard}
        onCloseReveal={() => collection.setPurchasedKind(null)}
      />
    );
  }

  if (screen === "menu") {
    return (
      <MenuScreen
        coins={collection.coins}
        photonAvailable={Boolean(PHOTON_APP_ID)}
        rulesOpen={rulesOpen}
        onStart={startGame}
        onStartOnline={startOnlineGame}
        onDeck={() => {
          playSfx("click", 0.38);
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

  return (
    <GameScene
      mode={mode}
      game={game}
      network={network}
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
      remainingHealth={remainingHealth}
      canTarget={canCardTargetCell}
      onCardDown={cardDrag.begin}
      onCardMove={cardDrag.move}
      onCardUp={cardDrag.finish}
      onCardCancel={cardDrag.cancel}
      onPause={() => setPauseOpen(true)}
      onResume={() => setPauseOpen(false)}
      onMenu={leaveToMenu}
      onRechange={rechangeCard}
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
