import type { GameWorld } from "../../game/game-world";

export function WorldLoading({ world, failed, onRetry, onBack, language }: {
  world: GameWorld; failed: boolean; onRetry: () => void; onBack: () => void; language: "ru" | "en";
}) {
  const ru = language === "ru";
  return <section className={`world-loading world-loading-${world}`} aria-label={ru ? "Переход между играми" : "Switching games"}>
    <div className="world-loading-mark" aria-hidden="true"><span>×</span><span>○</span><span>+</span></div>
    <span className="eyebrow">{world.toUpperCase()}</span>
    <h1>{world === "tttr" ? "Tic Tac Toe Roguelite" : "Tic Tac Toe Plus"}</h1>
    <p role={failed ? "alert" : "status"}>{failed
      ? (ru ? "Не удалось загрузить игру. Проверьте соединение и попробуйте снова." : "Could not load the game. Check your connection and try again.")
      : (ru ? "Загружаем игру…" : "Loading game…")}</p>
    {failed && <button className="primary-button" onClick={onRetry}>{ru ? "Повторить" : "Retry"}</button>}
    <button className="secondary-button" onClick={onBack}>{ru ? "Назад" : "Back"}</button>
  </section>;
}
