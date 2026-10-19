import { useState } from "react";
import { GameRuntime } from "../GameRuntime";
import { useLocalization } from "../../game/localization";
import { useGameSession } from "./GameSessionProvider";
import { useRogueliteProgress } from "./hooks/useRogueliteProgress";
import { WorldControls, type WorldSceneProps } from "./WorldControls";
import { MenuFrame } from "./MenuFrame";
import { Image } from "./Image";
import { Figure, SoundIcon } from "./Primitives";

const noCollectionProgress = async () => [];

export function RogueliteWorld({ worldControls }: WorldSceneProps) {
  const { active, audio } = useGameSession();
  const progress = useRogueliteProgress();
  const { language, setLanguage, theme, setTheme, t } = useLocalization();
  const ru = language === "ru";
  const [panel, setPanel] = useState<"menu" | "collection" | "store" | "settings">("menu");
  const saveNotice = progress.failed && <p className="roguelite-save-error" role="alert">
    {ru ? "Не удалось сохранить прогресс. Проверьте хранилище и повторите действие." : "Could not save progress. Check storage and retry the action."}
    {!progress.progress && <button className="secondary-button" onClick={progress.restore}>{ru ? "Повторить" : "Retry"}</button>}
  </p>;

  return <GameRuntime roguelite active={active} audio={audio} selectedKinds={[]}
    recordRound={noCollectionProgress} onRogueliteStart={progress.start} onRogueliteResult={progress.resolve}
    renderExperience={() => <>{saveNotice}<p className="roguelite-round-note">{ru ? "Результат этапа сохраняется при продолжении или выходе в меню." : "Stage results are saved when you continue or return to the menu."}</p></>}
    renderNavigation={({ onStart }) => <MenuFrame worldControls={<WorldControls {...worldControls} />}
      brand={<div className="roguelite-logo" aria-label="Tic Tac Toe Roguelite">
        <div aria-hidden="true"><Figure player={1} /><Figure player={2} /></div>
        <span>TIC TAC TOE</span><h1>ROGUELITE</h1>
      </div>}>
      {panel === "menu" ? <>
        <div className="unity-menu-actions">
          <button className="unity-menu-button unity-menu-button-main" disabled={!progress.progress} onClick={() => onStart("roguelike")}>{ru ? "Новый забег" : "New run"}</button>
        </div>
        <dl className="roguelite-stats">
          <div><dt>{ru ? "Забегов" : "Runs"}</dt><dd>{progress.progress?.runsStarted ?? "—"}</dd></div>
          <div><dt>{ru ? "Побед" : "Victories"}</dt><dd>{progress.progress?.victories ?? "—"}</dd></div>
          <div><dt>{ru ? "Рекорд" : "Best run"}</dt><dd>{progress.progress?.bestVictories ?? "—"}</dd></div>
        </dl>
        {saveNotice}
        <p className="roguelite-local-note">{ru ? "Прогресс сохраняется на этом устройстве" : "Progress is saved on this device"}</p>
        <nav className="unity-menu-nav" aria-label={ru ? "Разделы TTTR" : "TTTR sections"}>
          <button onClick={() => setPanel("collection")}><Image src="/game/menu/deck.png" alt="" width="88" height="76" unoptimized /><span>{ru ? "Карты" : "Cards"}</span></button>
          <button onClick={() => setPanel("store")}><Image src="/game/menu/store.png" alt="" width="88" height="76" unoptimized /><span>{t("store")}</span></button>
          <button onClick={() => setPanel("settings")}><Image src="/game/menu/settings.png" alt="" width="88" height="76" unoptimized /><span>{t("settings")}</span></button>
        </nav>
      </> : <section className="roguelite-panel">
        <h2>{panel === "settings" ? t("settings") : panel === "collection" ? (ru ? "Карты TTTR" : "TTTR cards") : (ru ? "Магазин TTTR" : "TTTR store")}</h2>
        {panel === "settings" ? <div className="settings-panel">
          <button className="settings-row settings-toggle" onClick={() => setLanguage(ru ? "en" : "ru")}><span>{t("language")}</span><strong>{ru ? t("russian") : t("english")}</strong></button>
          <button className="settings-row settings-toggle" onClick={() => audio.setMuted(!audio.muted)} aria-pressed={audio.muted}><span>{t("sound")}</span><span className="settings-sound-state"><SoundIcon muted={audio.muted} /><strong>{audio.muted ? t("soundOff") : t("soundOn")}</strong></span></button>
          <button className="settings-row settings-toggle" onClick={() => setTheme(theme === "light" ? "dark" : "light")}><span>{t("theme")}</span><strong>{theme === "light" ? t("classic") : t("dark")}</strong></button>
        </div> : <>
          <span className="eyebrow">{t("inDevelopment")}</span>
          <p>{panel === "collection"
            ? (ru ? "Здесь появятся собственные карты и эффекты TTTR." : "TTTR will have its own cards and effects here.")
            : (ru ? "Здесь появятся покупки за отдельную валюту TTTR." : "Purchases with TTTR's own currency will be available here.")}</p>
        </>}
        <button className="unity-menu-button" onClick={() => setPanel("menu")}>{t("back")}</button>
      </section>}
    </MenuFrame>}
  />;
}
