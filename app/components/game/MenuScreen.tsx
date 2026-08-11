import Image from "next/image";
import { RulesModal } from "./RulesModal";
import type { GameMode } from "./types";

type MenuScreenProps = {
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
  return (
    <main className="unity-menu-shell">
      <header className="unity-menu-top">
        <button className="unity-top-action" onClick={props.onOpenRules}>
          <Image src="/game/menu/friends.png" alt="" width="64" height="64" unoptimized />
          Друзья
        </button>
        <a
          className="unity-discord-link"
          href="https://discord.gg/4PJbjRZtkU"
          target="_blank"
          rel="noreferrer"
          aria-label="Открыть Discord проекта"
        >
          <Image className="unity-discord" src="/game/menu/discord.png" alt="Discord" width="58" height="58" priority unoptimized />
        </a>
        <span className="unity-coins">
          {props.coins}
          <Image src="/game/menu/coin.png" alt="" width="32" height="32" unoptimized />
        </span>
      </header>

      <section className="unity-menu-content">
        <Image className="unity-logo" src="/game/logo.png" alt="Tic Tac Toe Plus Card Game" width="420" height="160" priority unoptimized />
        <div className="unity-menu-actions">
          <button className="unity-menu-button unity-menu-button-main" onClick={() => props.onStart("bot")}>Игра с ботом</button>
          <button className="unity-menu-button" onClick={() => props.onStart("roguelike")}>Рогалик</button>
          <button className="unity-menu-button" disabled={!props.photonAvailable} onClick={props.onStartOnline}>Мультиплеер</button>
          <button className="unity-menu-button" onClick={() => props.onStart("local")}>Игра с другом</button>
          <button className="unity-menu-button" onClick={props.onOpenRules}>Руководство</button>
        </div>

        <nav className="unity-menu-nav" aria-label="Разделы">
          <button onClick={props.onDeck}>
            <Image src="/game/menu/deck.png" alt="" width="88" height="76" unoptimized />
            <span>Колода</span>
          </button>
          <button onClick={props.onStore}>
            <Image src="/game/menu/store.png" alt="" width="88" height="76" unoptimized />
            <span>Магазин</span>
          </button>
          <button onClick={props.onSettings}>
            <Image src="/game/menu/settings.png" alt="" width="88" height="76" unoptimized />
            <span>Настройки</span>
          </button>
        </nav>
      </section>
      <RulesModal open={props.rulesOpen} onClose={props.onCloseRules} />
    </main>
  );
}
