import { lazy, useState } from "react";
import type { CardKind } from "../../game/cards";
import type { PhotonSnapshot } from "../../game/photon";
import { DeferredScreen } from "./DeferredScreen";
import { MatchmakingScreen } from "./MatchmakingScreen";
import { MenuScreen } from "./MenuScreen";
import type { GameMode, GameScreen } from "./types";
import type { useGameAudio } from "./hooks/useGameAudio";
import type { usePlayerCollection } from "./hooks/usePlayerCollection";

const PassScreen = lazy(() => import("./PassScreen").then((module) => ({ default: module.PassScreen })));
const DeckScreen = lazy(() => import("./DeckScreen").then((module) => ({ default: module.DeckScreen })));
const SettingsScreen = lazy(() => import("./SettingsScreen").then((module) => ({ default: module.SettingsScreen })));
const StoreScreen = lazy(() => import("./StoreScreen").then((module) => ({ default: module.StoreScreen })));

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
  const [passId, setPassId] = useState<string | undefined>();
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

  if (screen === "passes") return <DeferredScreen key={screen} onBack={onMenu}><PassScreen progression={collection.progression} initialId={passId} onBack={() => onNavigate("menu")} /></DeferredScreen>;

  if (screen === "collection") {
    return (
      <DeferredScreen key={screen} onBack={onMenu}>
      <DeckScreen
        progression={collection.progression}
        focusKind={deckFocusKind}
        selectedKinds={collection.selectedKinds}
        unlockedKinds={collection.unlockedKinds}
        onBack={() => onNavigate("menu")}
        onToggle={collection.toggleCard}
        onSave={() => {
          void collection.saveDeck().then((saved) => saved && onNavigate("menu"));
        }}
      />
      </DeferredScreen>
    );
  }

  if (screen === "settings") {
    return (
      <DeferredScreen key={screen} onBack={onMenu}>
      <SettingsScreen
        googleAvailable={collection.googleAvailable}
        googleEmail={collection.googleEmail}
        googleError={collection.googleError}
        googleLinked={collection.googleLinked}
        googlePending={collection.googlePending}
        muted={muted}
        playerName={collection.profileName}
        onBack={() => {
          collection.saveProfile();
          onNavigate("menu");
        }}
        onNameChange={collection.changeName}
        onConnectGoogle={collection.connectGoogle}
        onToggleSound={() => {
          audio.playSfx("click", 0.38);
          onMutedChange(!muted);
        }}
      />
      </DeferredScreen>
    );
  }

  if (screen === "store") {
    return (
      <DeferredScreen key={screen} onBack={onMenu}>
      <StoreScreen
        cloudReady={collection.cloudReady}
        coins={collection.coins}
        drops={collection.drops}
        passes={collection.progression.passes}
        purchaseError={collection.purchaseError}
        onDismissReveal={() => collection.setPurchasedKinds([])}
        purchasedKinds={collection.purchasedKinds}
        selectedKinds={collection.selectedKinds}
        unlockedKinds={collection.unlockedKinds}
        onAmbientSuspendedChange={audio.setAmbientSuspended}
        onBack={() => {
          collection.setPurchasedKinds([]);
          onNavigate("menu");
        }}
        onBuy={collection.buyCards}
        beginRewardAd={collection.beginRewardAd}
        syncState={collection.syncState}
        onRetrySync={() => void collection.synchronize()}
        onCompleteReveal={(lastKind) => {
          collection.setPurchasedKinds([]);
          onDeckFocusChange(lastKind);
          onNavigate("collection");
        }}
        playDock={audio.playRevealDock}
        startRevealAudio={audio.startCardRevealAudio}
        transactionPending={collection.transactionPending}
      />
      </DeferredScreen>
    );
  }

  if (screen === "matchmaking") {
    return <MatchmakingScreen network={network} onBot={onBot} onMenu={onMenu} />;
  }

  return (
    <MenuScreen
      passes={collection.progression.passes}
      onPass={(id) => { setPassId(id); onNavigate("passes"); }}
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
