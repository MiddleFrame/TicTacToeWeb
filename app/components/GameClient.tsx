"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CARD_DEFINITIONS,
  DECK_BUILDING_KINDS,
  STARTER_SELECTED_KINDS,
  type CardKind,
} from "../game/cards";
import {
  cardCost,
  createGame,
  endTurn,
  findScoringCells,
  placeFigure,
  playCard,
  rechangeRandomCard,
  settleClear,
  settleThaw,
  startNextRound,
  type GameState,
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
import type { DamageFlight, DragState, GameMode } from "./game/types";

const playerName = (player: Player) => (player === 1 ? "Крестики" : "Нолики");
const PHOTON_APP_ID = process.env.NEXT_PUBLIC_PHOTON_APP_ID ?? "";
const INITIAL_NETWORK: PhotonSnapshot = {
  phase: "idle",
  side: null,
  roomName: "",
  playerCount: 0,
  error: "",
};
const SFX_PATHS = {
  click: ["/game/audio/ui-click-01.ogg", "/game/audio/ui-click-02.ogg"],
  placeFill: [
    "/game/audio/figure-fill-01.ogg",
    "/game/audio/figure-fill-02.ogg",
  ],
  placeScale: [
    "/game/audio/figure-scale-01.ogg",
    "/game/audio/figure-scale-02.ogg",
  ],
  erase: [
    "/game/audio/damage-erase-01.ogg",
    "/game/audio/damage-erase-02.ogg",
  ],
  impact: [
    "/game/audio/damage-impact-01.ogg",
    "/game/audio/damage-impact-02.ogg",
    "/game/audio/damage-impact-03.ogg",
  ],
} as const;

function chooseBotTarget(game: GameState): number | null {
  const available = game.board
    .map((cell, index) =>
      cell === null && !game.frozen[index] ? index : -1,
    )
    .filter((index) => index >= 0);
  if (available.length === 0) return null;

  const center = (game.size - 1) / 2;
  return available.reduce((best, index) => {
    const boardForBot = [...game.board];
    boardForBot[index] = 2;
    const attack = findScoringCells(
      boardForBot,
      game.size,
      2,
      game.frozen,
    ).length;

    const boardForPlayer = [...game.board];
    boardForPlayer[index] = 1;
    const block = findScoringCells(
      boardForPlayer,
      game.size,
      1,
      game.frozen,
    ).length;
    const row = Math.floor(index / game.size);
    const column = index % game.size;
    const distance = Math.abs(row - center) + Math.abs(column - center);
    const value = attack * 100 + block * 45 - distance;

    return value > best.value ? { index, value } : best;
  }, { index: available[0], value: Number.NEGATIVE_INFINITY }).index;
}

export function GameClient() {
  const [screen, setScreen] = useState<"menu" | "collection" | "settings" | "store" | "game">("menu");
  const [mode, setMode] = useState<GameMode>("local");
  const [network, setNetwork] = useState<PhotonSnapshot>(INITIAL_NETWORK);
  const [networkIntentPending, setNetworkIntentPending] = useState(false);
  const [selectedDeckKinds, setSelectedDeckKinds] = useState<CardKind[]>([
    ...STARTER_SELECTED_KINDS,
  ]);
  const [unlockedKinds, setUnlockedKinds] = useState<CardKind[]>([
    ...STARTER_SELECTED_KINDS,
  ]);
  const [coins, setCoins] = useState(220);
  const [purchasedKind, setPurchasedKind] = useState<CardKind | null>(null);
  const [profileName, setProfileName] = useState("Игрок");
  const [game, setGame] = useState(createGame);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [pauseOpen, setPauseOpen] = useState(false);
  const [muted, setMuted] = useState(false);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [damageFlights, setDamageFlights] = useState<DamageFlight[]>([]);
  const [turnBanner, setTurnBanner] = useState<Player | null>(1);
  const [roguelike, setRoguelike] = useState<RoguelikeRun | null>(null);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const cellRefs = useRef<Record<number, HTMLButtonElement | null>>({});
  const healthBarRefs = useRef<Record<Player, HTMLDivElement | null>>({
    1: null,
    2: null,
  });
  const musicRef = useRef<HTMLAudioElement | null>(null);
  const mutedRef = useRef(false);
  const previousTurnRef = useRef<Player>(game.turn);
  const photonSession = useRef<PhotonGameSession | null>(null);
  if (photonSession.current === null) {
    photonSession.current = new PhotonGameSession({
      onSnapshot: () => undefined,
      onState: () => undefined,
      onIntent: () => undefined,
    });
  }

  const playSfx = useCallback((
    kind: keyof typeof SFX_PATHS,
    volume = 1,
  ): void => {
    if (mutedRef.current) return;
    const variants = SFX_PATHS[kind];
    const path = variants[Math.floor(Math.random() * variants.length)];
    const audio = new Audio(path);
    audio.volume = Math.min(1, volume);
    audio.playbackRate = 0.97 + Math.random() * 0.06;
    void audio.play().catch(() => undefined);
  }, []);

  useEffect(() => {
    const savedMuted = window.localStorage.getItem("tttp-muted") === "1";
    mutedRef.current = savedMuted;
    const restoreMuted = window.setTimeout(() => setMuted(savedMuted), 0);

    const music = new Audio("/game/audio/minimal-background-loop.ogg");
    music.loop = true;
    music.volume = savedMuted ? 0 : 0.24;
    musicRef.current = music;
    const unlockAudio = () => {
      if (!mutedRef.current) void music.play().catch(() => undefined);
    };
    window.addEventListener("pointerdown", unlockAudio, { once: true });
    return () => {
      window.clearTimeout(restoreMuted);
      window.removeEventListener("pointerdown", unlockAudio);
      music.pause();
      musicRef.current = null;
    };
  }, []);

  useEffect(() => {
    mutedRef.current = muted;
    window.localStorage.setItem("tttp-muted", muted ? "1" : "0");
    if (!musicRef.current) return;
    musicRef.current.volume = muted ? 0 : 0.24;
    if (muted) {
      musicRef.current.pause();
    } else {
      void musicRef.current.play().catch(() => undefined);
    }
  }, [muted]);

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
    if (game.phase !== "clearing") return;
    const canSettle =
      mode !== "online" || network.side === 1;
    playSfx("erase", 0.31);

    const targetPlayer: Player = game.turn === 1 ? 2 : 1;
    const targetRect = healthBarRefs.current[targetPlayer]?.getBoundingClientRect();
    const flights = targetRect
      ? game.clearingCells.flatMap((index, flightIndex) => {
          const sourceRect = cellRefs.current[index]?.getBoundingClientRect();
          if (!sourceRect) return [];
          const x = sourceRect.left + sourceRect.width / 2;
          const y = sourceRect.top + sourceRect.height / 2;
          const targetX = targetRect.left + targetRect.width / 2;
          const targetY = targetRect.top + targetRect.height / 2;
          return [{
            id: `${game.turn}-${index}-${game.scores[game.turn]}`,
            index,
            player: game.turn,
            dx: (targetX - x) * 0.9,
            dy: (targetY - y) * 0.9,
            delay: flightIndex * 75,
          }];
        })
      : [];
    setDamageFlights(flights);

    const impactTimeouts = flights.map((flight) =>
      window.setTimeout(
        () => playSfx("impact", 0.46),
        720 + flight.delay,
      ),
    );
    const timeout = window.setTimeout(() => {
      setDamageFlights([]);
      if (canSettle) {
        setGame((current) => settleClear(current));
      }
    }, Math.max(960, 850 + flights.length * 85));
    return () => {
      window.clearTimeout(timeout);
      impactTimeouts.forEach((impactTimeout) =>
        window.clearTimeout(impactTimeout),
      );
    };
  }, [
    game.clearingCells,
    game.phase,
    game.scores,
    game.turn,
    mode,
    network.side,
    playSfx,
  ]);

  useEffect(() => {
    if (screen !== "game" || previousTurnRef.current === game.turn) return;
    previousTurnRef.current = game.turn;
    setDrag(null);
    setTurnBanner(game.turn);
    const timeout = window.setTimeout(() => setTurnBanner(null), 760);
    return () => window.clearTimeout(timeout);
  }, [game.turn, screen]);

  useEffect(() => {
    if (!networkIntentPending) return;
    const timeout = window.setTimeout(
      () => setNetworkIntentPending(false),
      4000,
    );
    return () => window.clearTimeout(timeout);
  }, [networkIntentPending]);

  useEffect(() => {
    let timeout: number | undefined;
    try {
      const savedDeck = window.localStorage.getItem("tttp-deck");
      const savedUnlocked = window.localStorage.getItem("tttp-unlocked");
      const savedCoinsRaw = window.localStorage.getItem("tttp-coins");
      const savedCoins = savedCoinsRaw === null ? null : Number(savedCoinsRaw);
      const savedName = window.localStorage.getItem("tttp-player-name");
      const parsedDeck = savedDeck ? JSON.parse(savedDeck) : null;
      const parsedUnlocked = savedUnlocked ? JSON.parse(savedUnlocked) : null;
      const validUnlocked = Array.isArray(parsedUnlocked)
        ? parsedUnlocked.filter(
            (kind): kind is CardKind =>
              typeof kind === "string" &&
              DECK_BUILDING_KINDS.includes(kind as CardKind),
          )
        : [];
      const restoredUnlocked = [...new Set([...STARTER_SELECTED_KINDS, ...validUnlocked])];
      const validDeck = Array.isArray(parsedDeck)
        ? parsedDeck.filter(
            (kind): kind is CardKind =>
              typeof kind === "string" &&
              restoredUnlocked.includes(kind as CardKind),
          )
        : [];
      timeout = window.setTimeout(() => {
        setUnlockedKinds(restoredUnlocked);
        setSelectedDeckKinds(validDeck.length >= 5 ? [...new Set(validDeck)] : [...STARTER_SELECTED_KINDS]);
        if (savedCoins !== null && Number.isFinite(savedCoins) && savedCoins >= 0) setCoins(savedCoins);
        if (savedName) setProfileName(savedName.slice(0, 20));
      }, 0);
    } catch {}
    return () => {
      if (timeout !== undefined) window.clearTimeout(timeout);
    };
  }, []);

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
        const playable = current.hands[2].find((card) => {
          if (cardCost(current, card) > current.mana) return false;
          const definition = CARD_DEFINITIONS[card.kind];
          if (definition.target === "empty") return target !== null;
          if (definition.target === "ally") {
            return current.board.some((cell) => cell === 2);
          }
          return true;
        });

        if (!playable) return endTurn(current);
        const definition = CARD_DEFINITIONS[playable.kind];
        let cardTarget: number | undefined;
        if (definition.target === "empty") {
          cardTarget = target ?? undefined;
        } else if (definition.target === "ally") {
          cardTarget = current.board.findIndex((cell) => cell === 2);
        }
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
    Math.max(0, game.scoreToWin - game.scores[player === 1 ? 2 : 1]);

  const status = useMemo(() => {
    if (game.phase === "thawing") return "Лёд разбивается";
    if (game.phase === "clearing") return `Линия! +${game.lastGain}`;
    if (game.phase === "round-over") {
      return game.roundWinner
        ? `Раунд за ${playerName(game.roundWinner).toLowerCase()}`
        : "Раунд завершён вничью";
    }
    if (game.phase === "game-over") {
      return game.gameWinner
        ? `${playerName(game.gameWinner)} выиграли матч`
        : "Матч завершён вничью";
    }
    return game.lastAction;
  }, [game]);

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

  const resolveDragLocation = (
    cardId: string,
    clientX: number,
    clientY: number,
  ) => {
    const boardRect = boardRef.current?.getBoundingClientRect();
    const overField = Boolean(
      boardRect &&
        clientX >= boardRect.left &&
        clientX <= boardRect.right &&
        clientY >= boardRect.top &&
        clientY <= boardRect.bottom,
    );
    const element = document.elementFromPoint(clientX, clientY);
    const cell = element?.closest<HTMLElement>("[data-cell-index]");
    const parsedIndex = cell?.dataset.cellIndex
      ? Number(cell.dataset.cellIndex)
      : null;
    const hoverIndex =
      parsedIndex !== null && canCardTargetCell(cardId, parsedIndex)
        ? parsedIndex
        : null;
    return { overField, hoverIndex };
  };

  const beginCardDrag = (
    event: React.PointerEvent<HTMLButtonElement>,
    cardId: string,
  ) => {
    if (!isHumanTurn || networkIntentPending) return;
    const card = game.hands[game.turn].find((item) => item.id === cardId);
    if (!card || cardCost(game, card) > game.mana) return;
    playSfx("click", 0.25);
    event.currentTarget.setPointerCapture(event.pointerId);
    const rect = event.currentTarget.getBoundingClientRect();
    const homeX = rect.left + rect.width / 2;
    const homeY = rect.top + rect.height / 2;
    const pointerOffsetX = event.clientX - homeX;
    const pointerOffsetY = event.clientY - homeY;
    const location = resolveDragLocation(cardId, event.clientX, event.clientY);
    setDrag({
      cardId,
      x: homeX,
      y: homeY,
      homeX,
      homeY,
      pointerOffsetX,
      pointerOffsetY,
      returning: false,
      ...location,
    });
  };

  const moveCardDrag = (
    event: React.PointerEvent<HTMLButtonElement>,
    cardId: string,
  ) => {
    if (drag?.cardId !== cardId) return;
    const location = resolveDragLocation(cardId, event.clientX, event.clientY);
    setDrag({
      ...drag,
      x: event.clientX - drag.pointerOffsetX,
      y: event.clientY - drag.pointerOffsetY,
      ...location,
    });
  };

  const returnCardToHand = (cardId: string) => {
    setDrag((current) =>
      current?.cardId === cardId
        ? {
            ...current,
            x: current.homeX,
            y: current.homeY,
            hoverIndex: null,
            overField: false,
            returning: true,
          }
        : current,
    );
    window.setTimeout(() => {
      setDrag((current) =>
        current?.cardId === cardId && current.returning ? null : current,
      );
    }, 205);
  };

  const finishCardDrag = (
    event: React.PointerEvent<HTMLButtonElement>,
    cardId: string,
  ) => {
    if (drag?.cardId !== cardId) return;
    const card = game.hands[game.turn].find((item) => item.id === cardId);
    const definition = card ? CARD_DEFINITIONS[card.kind] : null;
    const location = resolveDragLocation(cardId, event.clientX, event.clientY);
    if (!definition || !location.overField) {
      returnCardToHand(cardId);
      return;
    }
    if (definition.target === "none") {
      setDrag(null);
      playCardFromHand(cardId);
    } else if (location.hoverIndex !== null) {
      setDrag(null);
      playCardFromHand(cardId, location.hoverIndex);
    } else {
      returnCardToHand(cardId);
    }
  };

  const startGame = (nextMode: GameMode) => {
    playSfx("click", 0.38);
    const nextRun = nextMode === "roguelike" ? createRoguelikeRun() : null;
    const next = nextRun
      ? createRoguelikeGame(nextRun)
      : createGame(selectedDeckKinds);
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
    const next = createGame(selectedDeckKinds);
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
    setDrag(null);
    setDamageFlights([]);
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

  const toggleDeckCard = (kind: CardKind) => {
    if (!unlockedKinds.includes(kind)) return;
    setSelectedDeckKinds((current) => {
      if (current.includes(kind)) {
        return current.length <= 5
          ? current
          : current.filter((currentKind) => currentKind !== kind);
      }
      return [...current, kind];
    });
  };

  const buyRandomCard = () => {
    const locked = DECK_BUILDING_KINDS.filter((kind) => !unlockedKinds.includes(kind));
    if (coins < 50 || locked.length === 0) return;
    playSfx("click", 0.38);
    const kind = locked[Math.floor(Math.random() * locked.length)];
    const nextCoins = coins - 50;
    const nextUnlocked = [...unlockedKinds, kind];
    setCoins(nextCoins);
    setUnlockedKinds(nextUnlocked);
    setSelectedDeckKinds((current) => current.includes(kind) ? current : [...current, kind]);
    setPurchasedKind(kind);
    window.localStorage.setItem("tttp-coins", String(nextCoins));
    window.localStorage.setItem("tttp-unlocked", JSON.stringify(nextUnlocked));
    window.localStorage.setItem("tttp-deck", JSON.stringify([...selectedDeckKinds, kind]));
  };

  if (screen === "collection") {
    return (
      <DeckScreen
        selectedKinds={selectedDeckKinds}
        unlockedKinds={unlockedKinds}
        onBack={() => setScreen("menu")}
        onToggle={toggleDeckCard}
        onSave={() => {
          window.localStorage.setItem("tttp-deck", JSON.stringify(selectedDeckKinds));
          setScreen("menu");
        }}
      />
    );
  }

  if (screen === "settings") {
    return (
      <SettingsScreen
        muted={muted}
        playerName={profileName}
        onBack={() => setScreen("menu")}
        onNameChange={(name) => {
          setProfileName(name);
          window.localStorage.setItem("tttp-player-name", name);
        }}
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
        coins={coins}
        lockedKinds={DECK_BUILDING_KINDS.filter((kind) => !unlockedKinds.includes(kind))}
        purchasedKind={purchasedKind}
        onBack={() => {
          setPurchasedKind(null);
          setScreen("menu");
        }}
        onBuy={buyRandomCard}
        onCloseReveal={() => setPurchasedKind(null)}
      />
    );
  }

  if (screen === "menu") {
    return (
      <MenuScreen
        coins={coins}
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
      drag={drag}
      damageFlights={damageFlights}
      turnBanner={turnBanner}
      pauseOpen={pauseOpen}
      rulesOpen={rulesOpen}
      status={status}
      roguelike={roguelike}
      boardRef={boardRef}
      setCellRef={(index, node) => { cellRefs.current[index] = node; }}
      setHealthRef={(player, node) => { healthBarRefs.current[player] = node; }}
      remainingHealth={remainingHealth}
      canTarget={canCardTargetCell}
      onCardDown={beginCardDrag}
      onCardMove={moveCardDrag}
      onCardUp={finishCardDrag}
      onCardCancel={returnCardToHand}
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
