import Image from "next/image";
import { SoundIcon } from "./Primitives";

type SettingsScreenProps = {
  muted: boolean;
  playerName: string;
  onBack: () => void;
  onNameChange: (name: string) => void;
  onToggleSound: () => void;
};

export function SettingsScreen(props: SettingsScreenProps) {
  return (
    <main className="settings-shell">
      <header className="section-screen-header">
        <button className="back-button" onClick={props.onBack} aria-label="Назад в меню">←</button>
        <div>
          <span>Параметры</span>
          <h1>Настройки</h1>
        </div>
      </header>
      <section className="settings-panel">
        <label className="settings-row settings-name-row">
          <span>Имя игрока</span>
          <input value={props.playerName} maxLength={20} onChange={(event) => props.onNameChange(event.target.value)} />
        </label>
        <div className="settings-row">
          <span>Язык</span>
          <strong>Русский</strong>
        </div>
        <button className="settings-row settings-toggle" onClick={props.onToggleSound} aria-pressed={props.muted}>
          <span>Звук</span>
          <span className="settings-sound-state">
            <SoundIcon muted={props.muted} />
            <strong>{props.muted ? "Выключен" : "Включён"}</strong>
          </span>
        </button>
        <div className="settings-row">
          <span>Тема</span>
          <strong>Классическая</strong>
        </div>
        <a className="settings-row settings-link" href="https://discord.gg/4PJbjRZtkU" target="_blank" rel="noreferrer">
          <span>Discord</span>
          <Image src="/game/menu/discord.png" alt="" width="34" height="34" unoptimized />
        </a>
      </section>
    </main>
  );
}
