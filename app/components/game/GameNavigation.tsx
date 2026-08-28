import type { CardKind } from "../../game/cards";
import type { PhotonSnapshot } from "../../game/photon";
import { DeckScreen } from "./DeckScreen";
import { MatchmakingScreen } from "./MatchmakingScreen";
import { MenuScreen } from "./MenuScreen";
import { SettingsScreen } from "./SettingsScreen";
import { StoreScreen } from "./StoreScreen";
import type { GameMode, GameScreen } from "./types";
import type { useGameAudio } from "./hooks/useGameAudio";
import type { usePlayerCollection } from "./hooks/usePlayerCollection";
import { CARD_PRICE } from "../../game/card-purchase";

type NavigationScreen = Exclude<GameScreen, "game">;
type Collection = ReturnType<typeof usePlayerCollection>;
type Audio = ReturnType<typeof useGameAudio>;

type GameNavigationProps = {
  audio: Pick<
    Audio,
    "playRevealDock" | "playSfx" | "setAmbientSuspended" | "startCardRevealAudio"
  >;
  collection: Collection;
  deckFocusKind: CardKind | null;
  muted: boolean;
  network: PhotonSnapshot;
  onBot: () => void;
  onDeckFocusChange: (kind: CardKind | null) => void;
  onMenu: () => void;
  onMutedChange: (muted: boolean) => void;
  onNavigate: (screen: NavigationScreen) => void;
  onRulesChange: (open: boolean) => void;
  onStart: (mode: GameMode) => void;
  onStartOnline: () => void;
  photonAvailable: boolean;
  rulesOpen: boolean;
  screen: NavigationScreen;
};

export function GameNavigation(props: GameNavigationProps) {
  const {
    audio,
    collection,
    deckFocusKind,
    muted,
    network,
    onBot,
    onDeckFocusChange,
    onMenu,
    onMutedChange,
    onNavigate,
    onRulesChange,
    onStart,
    onStartOnline,
    photonAvailable,
    rulesOpen,
    screen,
  } = props;

  if (screen === "collection") {
    return (
      <DeckScreen
        focusKind={deckFocusKind}
        selectedKinds={collection.selectedKinds}
        unlockedKinds={collection.unlockedKinds}
        onBack={() => onNavigate("menu")}
        onToggle={collection.toggleCard}
        onSave={() => {
          collection.saveDeck();
          onNavigate("menu");
        }}
      />
    );
  }

  if (screen === "settings") {
    return (
      <SettingsScreen
        muted={muted}
        playerName={collection.profileName}
        onBack={() => onNavigate("menu")}
        onNameChange={collection.changeName}
        onToggleSound={() => {
          audio.playSfx("click", 0.38);
          onMutedChange(!muted);
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
        onAmbientSuspendedChange={audio.setAmbientSuspended}
        onBack={() => {
          collection.setPurchasedKinds([]);
          onNavigate("menu");
        }}
        onBuy={collection.buyCards}
        onRewardAd={() => collection.creditCoins(CARD_PRICE)}
        onCompleteReveal={(lastKind) => {
          collection.setPurchasedKinds([]);
          onDeckFocusChange(lastKind);
          onNavigate("collection");
        }}
        playDock={audio.playRevealDock}
        startRevealAudio={audio.startCardRevealAudio}
      />
    );
  }

  if (screen === "matchmaking") {
    return <MatchmakingScreen network={network} onBot={onBot} onMenu={onMenu} />;
  }

  return (
    <MenuScreen
      coins={collection.coins}
      photonAvailable={photonAvailable}
      rulesOpen={rulesOpen}
      onStart={onStart}
      onStartOnline={onStartOnline}
      onDeck={() => {
        audio.playSfx("click", 0.38);
        onDeckFocusChange(null);
        onNavigate("collection");
      }}
      onStore={() => {
        audio.playSfx("click", 0.38);
        onNavigate("store");
      }}
      onSettings={() => {
        audio.playSfx("click", 0.38);
        onNavigate("settings");
      }}
      onOpenRules={() => {
        audio.playSfx("click", 0.38);
        onRulesChange(true);
      }}
      onCloseRules={() => onRulesChange(false)}
    />
  );
}
