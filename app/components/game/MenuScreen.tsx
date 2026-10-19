import type { ElementPasses } from "../../game/element-progression";
import type { ReactNode } from "react";
import { PassShortcuts } from "./ElementProgress";
import { useLocalization } from "../../game/localization";
import { Image } from "./Image";
import { RulesModal } from "./RulesModal";
import type { GameMode } from "./types";
import { MenuFrame } from "./MenuFrame";

type MenuScreenProps = {
  worldControls: ReactNode;
  passes: ElementPasses;
  onPass: (id: string) => void;
  coins: number;
  photonAvailable: boolean;
  rulesOpen: boolean;
  onStart: (mode: GameMode) => void;
  onStartOnline: () => void;
  onDeck: () => void;
  onStore: () => void;
  onSettings: () => void;
  onOpenRules: () => void;
  onCloseRules: () => void;
};

export function MenuScreen(props: MenuScreenProps) {
  const { t } = useLocalization();
  return (
    <>
    <MenuFrame coins={props.coins} worldControls={props.worldControls}
      brand={<Image className="unity-logo" src="/game/logo.png" alt="Tic Tac Toe Plus Card Game" width="420" height="160" priority unoptimized />}>
        <div className="unity-menu-actions">
          <button className="unity-menu-button unity-menu-button-main" onClick={() => props.onStart("bot")}>{t("bot")}</button>
          <button className="unity-menu-button" disabled={!props.photonAvailable} onClick={props.onStartOnline}>{t("multiplayer")}</button>
          <button className="unity-menu-button" onClick={() => props.onStart("local")}>{t("local")}</button>
          <button className="unity-menu-button" onClick={props.onOpenRules}>{t("guide")}</button>
        </div>

        <PassShortcuts passes={props.passes} onOpen={props.onPass} />
        <nav className="unity-menu-nav" aria-label="Разделы">
          <button onClick={props.onDeck}>
            <Image src="/game/menu/deck.png" alt="" width="88" height="76" unoptimized />
            <span>{t("deck")}</span>
          </button>
          <button onClick={props.onStore}>
            <Image src="/game/menu/store.png" alt="" width="88" height="76" unoptimized />
            <span>{t("store")}</span>
          </button>
          <button onClick={props.onSettings}>
            <Image src="/game/menu/settings.png" alt="" width="88" height="76" unoptimized />
            <span>{t("settings")}</span>
          </button>
        </nav>
    </MenuFrame>
      <RulesModal open={props.rulesOpen} onClose={props.onCloseRules} />
    </>
  );
}
