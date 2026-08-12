import type { GameState, Player } from "../../game/engine";
import type { PhotonSnapshot } from "../../game/photon";
import { Figure } from "./Primitives";
import { useLocalization } from "../../game/localization";

export function TurnBanner({ player, turn }: { player: Player | null; turn: Player }) {
  const { t } = useLocalization();
  if (!player) return null;
  return (
    <div className="unity-turn-banner" key={`${player}-${turn}`}>
      <span>{t("turn")}</span>
      <Figure player={player} />
    </div>
  );
}

export function PauseModal({ open, onResume, onMenu }: { open: boolean; onResume: () => void; onMenu: () => void }) {
  const { t } = useLocalization();
  if (!open) return null;
  return (
    <div className="modal-backdrop pause-backdrop" role="presentation">
      <section className="pause-modal" role="dialog" aria-modal="true" aria-labelledby="pause-title">
        <h2 id="pause-title">{t("pause")}</h2>
        <button className="primary-button" onClick={onResume}>{t("resume")}</button>
        <button className="secondary-button" onClick={onMenu}>{t("toMenu")}</button>
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
  const { t } = useLocalization();
  if (game.phase !== "round-over" && game.phase !== "game-over") return null;
  return (
    <div className="modal-backdrop" role="presentation">
      <section className="result-modal" role="dialog" aria-modal="true" aria-labelledby="result-title">
        <span className="eyebrow">{game.phase === "game-over" ? t("matchComplete") : `${t("round")} ${game.completedRounds}`}</span>
        <h2 id="result-title">{status}</h2>
        <p>{game.phase === "game-over" ? `${t("scoreByRounds")}: ${game.roundWins[1]} : ${game.roundWins[2]}` : `${t("nextBoard")} — ${3 + game.completedRounds}×${3 + game.completedRounds}, ${t("mana")} — ${3 + game.completedRounds}`}</p>
        <div className="result-actions">
          <button className="primary-button" onClick={onContinue}>{game.phase === "game-over" ? t("newMatch") : t("nextRound")}</button>
          <button className="secondary-button menu-return-button" onClick={onMenu}>{t("mainMenu")}</button>
        </div>
      </section>
    </div>
  );
}

export function NetworkOverlay({ network, onMenu }: { network: PhotonSnapshot; onMenu: () => void }) {
  const { t } = useLocalization();
  if (network.phase === "ready") return null;
  return (
    <div className="network-backdrop">
      <section className="network-card" aria-live="polite">
        {network.phase !== "error" && <span className="network-spinner" aria-hidden="true" />}
        <h2>{network.phase === "error" ? t("connectFailed") : network.phase === "waiting" ? t("waitingOpponent") : t("connecting")}</h2>
        <p>{network.error || (network.phase === "waiting" ? t("roomCreated") : t("searchingMatch"))}</p>
        {network.roomName && <code>{network.roomName}</code>}
        <button className="secondary-button" onClick={onMenu}>{t("returnMenu")}</button>
      </section>
    </div>
  );
}
