import {
  createGame,
  endTurn,
  playCard,
  rechangeRandomCard,
  startNextRound,
  type GameState,
  type Player,
} from "./engine.ts";

export type NetworkIntent =
  | { type: "play"; cardId: string; targetIndex?: number }
  | { type: "end-turn" }
  | { type: "rechange" }
  | { type: "next-round" };

export type NetworkPhase =
  | "idle"
  | "connecting"
  | "waiting"
  | "ready"
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
  onActorLeave: (actor: PhotonActor) => void;
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

interface PhotonCallbacks {
  onSnapshot: (snapshot: PhotonSnapshot) => void;
  onState: (state: GameState) => void;
  onIntent: (intent: NetworkIntent) => void;
}

const EVENT_STATE = 11;
const EVENT_INTENT = 12;

export function applyNetworkIntent(
  state: GameState,
  intent: NetworkIntent,
  senderSide: Player,
): GameState {
  if (senderSide !== 2 || !intent || typeof intent !== "object") {
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
    if (typeof intent.cardId !== "string") return state;
    return playCard(state, intent.cardId, intent.targetIndex);
  }
  if (intent.type === "end-turn") return endTurn(state);
  if (intent.type === "rechange") return rechangeRandomCard(state);
  return state;
}

const initialSnapshot: PhotonSnapshot = {
  phase: "idle",
  side: null,
  roomName: "",
  playerCount: 0,
  error: "",
};

export class PhotonGameSession {
  private client: PhotonClient | null = null;
  private photon: PhotonModule | null = null;
  private snapshot: PhotonSnapshot = initialSnapshot;
  private callbacks: PhotonCallbacks;

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

  async connect(appId: string): Promise<void> {
    if (!appId || this.snapshot.phase === "connecting") return;
    this.disconnect();
    this.emit({ ...initialSnapshot, phase: "connecting" });

    try {
      const imported = await import("photon-realtime");
      const photon = (
        "default" in imported ? imported.default : imported
      ) as PhotonModule;
      this.photon = photon;
      const Client = photon.LoadBalancing.LoadBalancingClient;
      const client = new Client(
        photon.ConnectionProtocol.Wss,
        appId,
        "tttp-web-1",
      );
      client.autoJoinLobby = true;
      this.client = client;

      client.onStateChange = (state) => {
        if (state === Client.State.JoinedLobby) {
          client.joinRandomOrCreateRoom({}, undefined, {
            maxPlayers: 2,
            isVisible: true,
            isOpen: true,
          });
          return;
        }
        if (state === Client.State.Joined) {
          const side: Player = client.myActor().actorNr === 1 ? 1 : 2;
          const playerCount = client.actorsArray.length;
          this.emit({
            phase: playerCount >= 2 ? "ready" : "waiting",
            side,
            roomName: client.myRoom().name,
            playerCount,
            error: "",
          });
          return;
        }
        if (state === Client.State.Error) {
          this.emit({
            phase: "error",
            error: "Не удалось подключиться к Photon",
          });
        }
      };

      client.onActorJoin = () => {
        const playerCount = client.actorsArray.length;
        this.emit({
          playerCount,
          phase: playerCount >= 2 ? "ready" : "waiting",
        });
      };
      client.onActorLeave = () => {
        if (this.client !== client) return;
        this.client = null;
        this.photon = null;
        this.emit({
          playerCount: 1,
          phase: "error",
          error: "Соперник вышел из матча",
        });
        client.disconnect();
      };
      client.onError = (_code, message) => {
        this.emit({
          phase: "error",
          error: message || "Ошибка соединения Photon",
        });
      };
      client.onEvent = (code, content) => {
        if (code === EVENT_STATE) {
          this.callbacks.onState(content as GameState);
        } else if (code === EVENT_INTENT) {
          this.callbacks.onIntent(content as NetworkIntent);
        }
      };

      photon.setOnLoad(() => {
        if (this.client === client) client.connectToRegionMaster("EU");
      });
    } catch (error) {
      console.error("Photon startup failed", error);
      this.emit({
        phase: "error",
        error: "Сетевой модуль Photon не загрузился",
      });
    }
  }

  broadcastState(state: GameState): void {
    if (!this.client?.isJoinedToRoom() || !this.photon) return;
    this.client.raiseEvent(EVENT_STATE, state, {
      receivers:
        this.photon.LoadBalancing.Constants.ReceiverGroup.Others,
    });
  }

  sendIntent(intent: NetworkIntent): void {
    if (!this.client?.isJoinedToRoom() || !this.photon) return;
    this.client.raiseEvent(EVENT_INTENT, intent, {
      receivers:
        this.photon.LoadBalancing.Constants.ReceiverGroup.Others,
    });
  }

  disconnect(): void {
    this.client?.disconnect();
    this.client = null;
    this.photon = null;
    this.snapshot = initialSnapshot;
    this.callbacks.onSnapshot(initialSnapshot);
  }
}
