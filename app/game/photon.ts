import {
  createGame,
  endTurn,
  playCard,
  rechangeRandomCard,
  startNextRound,
  type GameState,
  type Player,
} from "./engine.ts";
import type { PhotonGameConfig } from "./photon-config.ts";
import { isNetworkGameState, isNetworkIntent, type NetworkIntent } from "./network-message.ts";
export type { NetworkIntent } from "./network-message.ts";

export type NetworkPhase =
  | "idle"
  | "connecting"
  | "waiting"
  | "ready"
  | "opponent-left"
  | "error";

export interface PhotonSnapshot {
  phase: NetworkPhase;
  side: Player | null;
  roomName: string;
  playerCount: number;
  error: string;
}

interface PhotonActor {
  actorNr: number;
}

interface PhotonRoom {
  name: string;
}

interface PhotonClient {
  actorsArray: PhotonActor[];
  autoJoinLobby: boolean;
  onStateChange: (state: number) => void;
  onError: (code: number, message: string) => void;
  onEvent: (code: number, content: unknown, actorNr: number) => void;
  onActorJoin: (actor: PhotonActor) => void;
  onActorLeave: (actor: PhotonActor, cleanup?: boolean) => void;
  joinRandomOrCreateRoom: (
    matchmaking: object,
    roomName: string | undefined,
    options: object,
  ) => boolean;
  connectToRegionMaster: (region: string) => boolean;
  disconnect: () => void;
  isJoinedToRoom: () => boolean;
  myActor: () => PhotonActor;
  myRoom: () => PhotonRoom;
  raiseEvent: (code: number, content: unknown, options?: object) => void;
}

interface PhotonClientConstructor {
  new (protocol: number, appId: string, appVersion: string): PhotonClient;
  State: {
    JoinedLobby: number;
    Joined: number;
    Disconnected: number;
    Error: number;
  };
}

interface PhotonModule {
  ConnectionProtocol: { Wss: number };
  LoadBalancing: {
    LoadBalancingClient: PhotonClientConstructor;
    Constants: {
      ReceiverGroup: { Others: number };
    };
  };
  setOnLoad: (callback: () => void) => void;
}

export interface PhotonCallbacks {
  onOpponentLeave: (winner: Player) => void;
  onSnapshot: (snapshot: PhotonSnapshot) => void;
  onState: (state: GameState) => void;
  onIntent: (intent: NetworkIntent) => void;
}

export interface PhotonSession {
  updateCallbacks: (callbacks: PhotonCallbacks) => void;
  connect: (config: PhotonGameConfig) => Promise<void>;
  broadcastState: (state: GameState) => void;
  sendIntent: (intent: NetworkIntent) => void;
  disconnect: () => void;
}

export type PhotonSessionFactory = (callbacks: PhotonCallbacks) => PhotonSession;

const EVENT_STATE = 11;
const EVENT_INTENT = 12;

export function applyNetworkIntent(
  state: GameState,
  intent: NetworkIntent,
  senderSide: Player,
): GameState {
  if (senderSide !== 2 || !isNetworkIntent(intent)) {
    return state;
  }

  if (intent.type === "next-round") {
    if (state.phase === "game-over") return createGame(state.deckKinds);
    if (state.phase === "round-over") return startNextRound(state);
    return state;
  }

  if (state.phase !== "playing" || state.turn !== senderSide) {
    return state;
  }

  if (intent.type === "play") {
    if (intent.targetIndex !== undefined && intent.targetIndex >= state.board.length) return state;
    return playCard(state, intent.cardId, intent.targetIndex);
  }
  if (intent.type === "end-turn") return endTurn(state);
  if (intent.type === "rechange") return rechangeRandomCard(state);
  return state;
}

export const INITIAL_PHOTON_SNAPSHOT: PhotonSnapshot = {
  phase: "idle",
  side: null,
  roomName: "",
  playerCount: 0,
  error: "",
};

export class PhotonGameSession {
  private client: PhotonClient | null = null;
  private photon: PhotonModule | null = null;
  private snapshot: PhotonSnapshot = INITIAL_PHOTON_SNAPSHOT;
  private callbacks: PhotonCallbacks;
  private generation = 0;
  private opponentActorNr: number | null = null;

  constructor(callbacks: PhotonCallbacks) {
    this.callbacks = callbacks;
  }

  updateCallbacks(callbacks: PhotonCallbacks): void {
    this.callbacks = callbacks;
  }

  private emit(patch: Partial<PhotonSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch };
    this.callbacks.onSnapshot(this.snapshot);
  }

  async connect(config: PhotonGameConfig): Promise<void> {
    if (!config.appId || this.snapshot.phase === "connecting") return;
    this.disconnect();
    const generation = this.generation;
    this.emit({ ...INITIAL_PHOTON_SNAPSHOT, phase: "connecting" });

    try {
      const imported = await import("photon-realtime");
      if (generation !== this.generation) return;
      const photon = (
        "default" in imported ? imported.default : imported
      ) as PhotonModule;
      this.photon = photon;
      const Client = photon.LoadBalancing.LoadBalancingClient;
      const client = new Client(
        photon.ConnectionProtocol.Wss,
        config.appId,
        config.appVersion,
      );
      client.autoJoinLobby = true;
      this.client = client;
      const isCurrent = () => generation === this.generation && this.client === client;

      client.onStateChange = (state) => {
        if (!isCurrent()) return;
        if (state === Client.State.JoinedLobby) {
          const joining = client.joinRandomOrCreateRoom({}, undefined, {
            maxPlayers: 2,
            isVisible: true,
            isOpen: true,
          });
          if (!joining) this.failConnection("Не удалось найти комнату Photon");
          return;
        }
        if (state === Client.State.Joined) {
          const side: Player = client.myActor().actorNr === 1 ? 1 : 2;
          const playerCount = client.actorsArray.length;
          this.opponentActorNr = client.actorsArray.find((actor) => actor.actorNr !== client.myActor().actorNr)?.actorNr ?? null;
          this.emit({
            phase: playerCount >= 2 ? "ready" : "waiting",
            side,
            roomName: client.myRoom().name,
            playerCount,
            error: "",
          });
          return;
        }
        if (state === Client.State.Error || state === Client.State.Disconnected) {
          this.failConnection("Не удалось подключиться к Photon");
        }
      };

      client.onActorJoin = () => {
        if (!isCurrent()) return;
        const playerCount = client.actorsArray.length;
        this.opponentActorNr = client.actorsArray.find((actor) => actor.actorNr !== client.myActor().actorNr)?.actorNr ?? null;
        this.emit({
          playerCount,
          phase: playerCount >= 2 ? "ready" : "waiting",
        });
      };
      client.onActorLeave = (actor, cleanup) => {
        if (!isCurrent() || cleanup || actor.actorNr !== this.opponentActorNr || this.snapshot.phase !== "ready") return;
        const winner = this.snapshot.side;
        this.releaseClient();
        this.emit({
          playerCount: 1,
          phase: "opponent-left",
          error: "Соперник вышел из матча",
        });
        if (winner) this.callbacks.onOpponentLeave(winner);
      };
      client.onError = (_code, message) => {
        if (!isCurrent()) return;
        this.failConnection(message || "Ошибка соединения Photon");
      };
      client.onEvent = (code, content, actorNr) => {
        if (!isCurrent() || this.snapshot.phase !== "ready" || !client.isJoinedToRoom() ||
          actorNr !== this.opponentActorNr || !client.actorsArray.some((actor) => actor.actorNr === actorNr)) return;
        if (code === EVENT_STATE && this.snapshot.side === 2 && actorNr === 1 && isNetworkGameState(content)) {
          this.callbacks.onState(content);
        } else if (code === EVENT_INTENT && this.snapshot.side === 1 && actorNr !== 1 && isNetworkIntent(content)) {
          this.callbacks.onIntent(content);
        }
      };

      photon.setOnLoad(() => {
        if (isCurrent() && !client.connectToRegionMaster(config.region)) {
          this.failConnection("Не удалось подключиться к Photon");
        }
      });
    } catch (error) {
      if (generation !== this.generation) return;
      console.error("Photon startup failed", error);
      this.failConnection("Сетевой модуль Photon не загрузился");
    }
  }

  broadcastState(state: GameState): void {
    if (!this.client?.isJoinedToRoom() || !this.photon || this.snapshot.phase !== "ready" || this.snapshot.side !== 1) return;
    this.client.raiseEvent(EVENT_STATE, state, {
      receivers:
        this.photon.LoadBalancing.Constants.ReceiverGroup.Others,
    });
  }

  sendIntent(intent: NetworkIntent): void {
    if (!this.client?.isJoinedToRoom() || !this.photon || this.snapshot.phase !== "ready" ||
      this.snapshot.side !== 2 || !isNetworkIntent(intent)) return;
    this.client.raiseEvent(EVENT_INTENT, intent, {
      receivers:
        this.photon.LoadBalancing.Constants.ReceiverGroup.Others,
    });
  }

  private releaseClient(): void {
    this.generation += 1;
    const client = this.client;
    this.client = null;
    this.photon = null;
    this.opponentActorNr = null;
    if (!client) return;
    client.onStateChange = () => undefined;
    client.onError = () => undefined;
    client.onEvent = () => undefined;
    client.onActorJoin = () => undefined;
    client.onActorLeave = () => undefined;
    client.disconnect();
  }

  private failConnection(error: string): void {
    this.releaseClient();
    this.emit({ ...INITIAL_PHOTON_SNAPSHOT, phase: "error", error });
  }

  disconnect(): void {
    this.releaseClient();
    this.snapshot = INITIAL_PHOTON_SNAPSHOT;
    this.callbacks.onSnapshot(INITIAL_PHOTON_SNAPSHOT);
  }
}

export const createPhotonSession: PhotonSessionFactory = (callbacks) =>
  new PhotonGameSession(callbacks);
