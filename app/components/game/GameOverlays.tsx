import type { GameState, Player } from "../../game/engine";
import type { PhotonSnapshot } from "../../game/photon";
import { Figure } from "./Primitives";

export function TurnBanner({ player, turn }: { player: Player | null; turn: Player }) {
  if (!player) return null;
  return (
    <div className="unity-turn-banner" key={`${player}-${turn}`}>
      <span>Ход</span>
      <Figure player={player} />
    </div>
  );
}

export function PauseModal({ open, onResume, onMenu }: { open: boolean; onResume: () => void; onMenu: () => void }) {
  if (!open) return null;
  return (
    <div className="modal-backdrop pause-backdrop" role="presentation">
      <section className="pause-modal" role="dialog" aria-modal="true" aria-labelledby="pause-title">
        <h2 id="pause-title">Пауза</h2>
        <button className="primary-button" onClick={onResume}>Продолжить</button>
        <button className="secondary-button" onClick={onMenu}>В меню</button>
      </section>
    </div>
  );
}

type ResultModalProps = {
  game: GameState;
  status: string;
  onContinue: () => void;
  onMenu: () => void;
};

export function ResultModal({ game, status, onContinue, onMenu }: ResultModalProps) {
  if (game.phase !== "round-over" && game.phase !== "game-over") return null;
  return (
    <div className="modal-backdrop" role="presentation">
      <section className="result-modal" role="dialog" aria-modal="true" aria-labelledby="result-title">
        <span className="eyebrow">{game.phase === "game-over" ? "Матч завершён" : `Раунд ${game.completedRounds}`}</span>
        <h2 id="result-title">{status}</h2>
        <p>{game.phase === "game-over" ? `Итог по раундам: ${game.roundWins[1]} : ${game.roundWins[2]}` : `Следующее поле — ${3 + game.completedRounds}×${3 + game.completedRounds}, мана — ${3 + game.completedRounds}`}</p>
        <div className="result-actions">
          <button className="primary-button" onClick={onContinue}>{game.phase === "game-over" ? "Новый матч" : "Следующий раунд"}</button>
          <button className="secondary-button menu-return-button" onClick={onMenu}>В главное меню</button>
        </div>
      </section>
    </div>
  );
}

export function NetworkOverlay({ network, onMenu }: { network: PhotonSnapshot; onMenu: () => void }) {
  if (network.phase === "ready") return null;
  return (
    <div className="network-backdrop">
      <section className="network-card" aria-live="polite">
        {network.phase !== "error" && <span className="network-spinner" aria-hidden="true" />}
        <h2>{network.phase === "error" ? "Не удалось подключиться" : network.phase === "waiting" ? "Ждём соперника" : "Подключаемся к Photon"}</h2>
        <p>{network.error || (network.phase === "waiting" ? "Комната создана. Матч начнётся, когда войдёт второй игрок." : "Ищем свободный матч в европейском регионе.")}</p>
        {network.roomName && <code>{network.roomName}</code>}
        <button className="secondary-button" onClick={onMenu}>Вернуться в меню</button>
      </section>
    </div>
  );
}
