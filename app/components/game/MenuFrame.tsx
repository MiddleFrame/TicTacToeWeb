import type { ReactNode } from "react";
import { useLocalization } from "../../game/localization";
import { Image } from "./Image";

export function MenuFrame({ brand, children, worldControls, coins }: {
  brand: ReactNode;
  children: ReactNode;
  worldControls: ReactNode;
  coins?: number;
}) {
  const { language, t } = useLocalization();
  return <main className="unity-menu-shell">
    <header className="unity-menu-top">
      <button className="unity-top-action" disabled>
        <Image src="/game/menu/friends.png" alt="" width="64" height="64" unoptimized />
        <span>{t("friends")}</span>
        <small>{t("inDevelopment")}</small>
      </button>
      <a className="unity-discord-link" href="https://discord.gg/4PJbjRZtkU" target="_blank" rel="noreferrer"
        aria-label={language === "ru" ? "Открыть Discord проекта" : "Open the project Discord"}>
        <Image className="unity-discord" src="/game/menu/discord-white.svg" alt="Discord" width="58" height="58" priority unoptimized />
      </a>
      {coins !== undefined && <span className="unity-coins">{coins}<Image src="/game/menu/coin.png" alt="" width="32" height="32" unoptimized /></span>}
    </header>
    <section className="unity-menu-content">{brand}{children}</section>
    <footer className="menu-world-footer">{worldControls}</footer>
  </main>;
}
