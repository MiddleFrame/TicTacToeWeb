import { useLocalization } from "../../game/localization";
import { Image } from "./Image";
import { BackIcon, SoundIcon } from "./Primitives";

type SettingsScreenProps = {
  googleAvailable: boolean;
  googleEmail: string | null;
  googleError: boolean;
  googleLinked: boolean;
  googlePending: boolean;
  muted: boolean;
  playerName: string;
  onBack: () => void;
  onConnectGoogle: () => void;
  onNameChange: (name: string) => void;
  onToggleSound: () => void;
};

export function SettingsScreen(props: SettingsScreenProps) {
  const { language, setLanguage, theme, setTheme, t } = useLocalization();
  return (
    <main className="settings-shell">
      <header className="section-screen-header">
        <button className="back-button" onClick={props.onBack} aria-label={t("back")}><BackIcon /></button>
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
        <button className="settings-row settings-toggle" onClick={() => setLanguage(language === "ru" ? "en" : "ru")}>
          <span>{t("language")}</span>
          <strong>{language === "ru" ? t("russian") : t("english")}</strong>
        </button>
        <button className="settings-row settings-toggle" onClick={props.onToggleSound} aria-pressed={props.muted}>
          <span>{t("sound")}</span>
          <span className="settings-sound-state">
            <SoundIcon muted={props.muted} />
            <strong>{props.muted ? t("soundOff") : t("soundOn")}</strong>
          </span>
        </button>
        <button className="settings-row settings-toggle" onClick={() => setTheme(theme === "light" ? "dark" : "light")}>
          <span>{t("theme")}</span>
          <strong>{theme === "light" ? t("classic") : t("dark")}</strong>
        </button>
        {props.googleAvailable && (
          <button
            className="settings-row settings-toggle settings-google"
            disabled={props.googlePending}
            onClick={props.onConnectGoogle}
          >
            <span>{t("googleAccount")}</span>
            <span className="settings-google-state">
              {props.googleLinked && (
                <small>{props.googleEmail ?? t("googleConnected")}</small>
              )}
              <strong className={props.googleError ? "settings-error" : ""}>
                {props.googlePending
                  ? t("googleConnecting")
                  : props.googleLinked
                    ? t("googleRelink")
                    : props.googleError
                      ? t("googleFailed")
                      : t("googleConnect")}
              </strong>
            </span>
          </button>
        )}
        <a className="settings-row settings-link" href="https://discord.gg/4PJbjRZtkU" target="_blank" rel="noreferrer">
          <span>Discord</span>
          <Image src="/game/menu/discord.png" alt="" width="34" height="34" unoptimized />
        </a>
      </section>
    </main>
  );
}
