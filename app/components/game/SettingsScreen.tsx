import Image from "next/image";
import { useLocalization } from "../../game/localization";
import { SoundIcon } from "./Primitives";

type SettingsScreenProps = {
  muted: boolean;
  playerName: string;
  onBack: () => void;
  onNameChange: (name: string) => void;
  onToggleSound: () => void;
};

export function SettingsScreen(props: SettingsScreenProps) {
  const { language, setLanguage, t } = useLocalization();
  return (
    <main className="settings-shell">
      <header className="section-screen-header">
        <button className="back-button" onClick={props.onBack} aria-label={t("back")}>←</button>
        <div>
          <span>{t("options")}</span>
          <h1>{t("settings")}</h1>
        </div>
      </header>
      <section className="settings-panel">
        <label className="settings-row settings-name-row">
          <span>{t("playerName")}</span>
          <input value={props.playerName} maxLength={20} onChange={(event) => props.onNameChange(event.target.value)} />
        </label>
        <label className="settings-row settings-language-row">
          <span>{t("language")}</span>
          <select value={language} onChange={(event) => setLanguage(event.target.value === "en" ? "en" : "ru")}>
            <option value="ru">{t("russian")}</option>
            <option value="en">{t("english")}</option>
          </select>
        </label>
        <button className="settings-row settings-toggle" onClick={props.onToggleSound} aria-pressed={props.muted}>
          <span>{t("sound")}</span>
          <span className="settings-sound-state">
            <SoundIcon muted={props.muted} />
            <strong>{props.muted ? t("soundOff") : t("soundOn")}</strong>
          </span>
        </button>
        <div className="settings-row">
          <span>{t("theme")}</span>
          <strong>{t("classic")}</strong>
        </div>
        <a className="settings-row settings-link" href="https://discord.gg/4PJbjRZtkU" target="_blank" rel="noreferrer">
          <span>Discord</span>
          <Image src="/game/menu/discord.png" alt="" width="34" height="34" unoptimized />
        </a>
      </section>
    </main>
  );
}
