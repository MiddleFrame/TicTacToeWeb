import { useState } from "react";
import { GameRuntime } from "../GameRuntime";
import { useLocalization } from "../../game/localization";
import { useGameSession } from "./GameSessionProvider";
import { useRogueliteProgress } from "./hooks/useRogueliteProgress";
import { WorldControls } from "./WorldControls";
import type { WorldSceneProps } from "./WorldControls";

const noCollectionProgress = async () => [];

export function RogueliteWorld({ worldControls }: WorldSceneProps) {
  const { active, audio } = useGameSession();
  const progress = useRogueliteProgress();
  const { language, setLanguage, t } = useLocalization();
  const ru = language === "ru";
  const [panel, setPanel] = useState<"menu" | "collection" | "store">("menu");
  const saveNotice = progress.failed && <p className="roguelite-save-error" role="alert">
    {ru ? "Не удалось прочитать или сохранить прогресс ТТТР. Данные сохранены без изменений. Повторите действие после проверки хранилища." : "Could not read or save TTTR progress. Saved data was left unchanged. Check storage and retry the action."}
    {!progress.progress && <button className="secondary-button" onClick={progress.restore}>{ru ? "Повторить" : "Retry"}</button>}
  </p>;

  return <GameRuntime roguelite active={active} audio={audio} selectedKinds={[]}
    recordRound={noCollectionProgress} onRogueliteStart={progress.start} onRogueliteResult={progress.resolve}
    renderExperience={() => <>{saveNotice}<p className="roguelite-round-note">{ru ? "Результат этапа сохраняется при продолжении или выходе в меню." : "Stage results are saved when you continue or return to the menu."}</p></>}
    renderNavigation={({ onStart }) => <main className="roguelite-home">
      <header className="roguelite-top"><span>TTTR</span><span>{ru ? "Роглайт" : "Roguelite"}</span></header>
      <section className="roguelite-home-content">
        <span className="eyebrow">Tic Tac Toe Roguelite</span>
        <h1>{ru ? "Каждый забег —\nновая история" : "Every run.\nA new story."}</h1>
        {panel === "menu" ? <>
          <p>{ru ? "Пройди дальше. Собери колоду в пути. Начни заново сильнее опытом." : "Go further. Build your deck along the way. Return with experience."}</p>
          <button className="roguelite-start" disabled={!progress.progress} onClick={() => onStart("roguelike")}>{ru ? "Новый забег" : "New run"}<span aria-hidden="true">↗</span></button>
          <dl className="roguelite-stats">
            <div><dt>{ru ? "Забегов" : "Runs"}</dt><dd>{progress.progress?.runsStarted ?? "—"}</dd></div>
            <div><dt>{ru ? "Побед на этапах" : "Stage victories"}</dt><dd>{progress.progress?.victories ?? "—"}</dd></div>
            <div><dt>{ru ? "Лучший забег" : "Best run"}</dt><dd>{progress.progress?.bestVictories ?? "—"}</dd></div>
          </dl>
          <nav className="roguelite-sections" aria-label={ru ? "Разделы ТТТР" : "TTTR sections"}>
            <button onClick={() => setPanel("collection")}>{ru ? "Карты ТТТР" : "TTTR cards"}</button>
            <button onClick={() => setPanel("store")}>{ru ? "Магазин ТТТР" : "TTTR store"}</button>
          </nav>
        </> : <section className="roguelite-placeholder">
          <h2>{panel === "collection" ? (ru ? "Своя коллекция" : "A separate collection") : (ru ? "Свой магазин" : "A separate store")}</h2>
          <p>{panel === "collection"
            ? (ru ? "Новые карты и эффекты ТТТР появятся на следующем этапе. Пока в забегах используется прототипный набор; коллекция ТТТП здесь не используется." : "New TTTR cards and effects are coming next. Runs currently use the prototype pool; your TTTP collection is separate.")
            : (ru ? "Валюта и покупки ТТТР будут добавлены вместе с его собственным контентом. Монеты и покупки ТТТП сюда не переносятся." : "TTTR currency and purchases will arrive with its own content. TTTP coins and purchases are separate.")}</p>
          <button className="secondary-button" onClick={() => setPanel("menu")}>{t("back")}</button>
        </section>}
        {saveNotice}
        <p className="roguelite-local-note">{ru ? "Прогресс ТТТР хранится на этом устройстве отдельно от ТТТП. Новый забег начинается с первого этапа." : "TTTR progress is stored on this device separately from TTTP. New runs begin at stage one."}</p>
        <div className="roguelite-options">
          <button onClick={() => audio.setMuted(!audio.muted)}>{t("sound")}: {audio.muted ? t("soundOff") : t("soundOn")}</button>
          <button onClick={() => setLanguage(ru ? "en" : "ru")}>{ru ? "English" : "Русский"}</button>
        </div>
        <WorldControls {...worldControls} />
      </section>
    </main>}
  />;
}
