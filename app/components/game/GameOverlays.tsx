import { ROUNDS_TO_WIN, type GameState, type Player } from "../../game/engine";
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
  viewer: Player | null;
  onContinue: () => void;
  onMenu: () => void;
};

function ResultAnimation({ winner }: { winner: Player | null }) {
  return (
    <div className={`result-animation ${winner ? `winner-${winner}` : "draw"}`} aria-hidden="true">
      <div className="result-rays">{Array.from({ length: 10 }, (_, index) => <span key={index} />)}</div>
      <div className="result-confetti">{Array.from({ length: 18 }, (_, index) => <i key={index} />)}</div>
      <div className="result-duel">
        <span className="result-impact">{winner ? "✦" : "="}</span>
        <Figure player={1} className="result-figure result-figure-x" />
        <Figure player={2} className="result-figure result-figure-o" />
      </div>
    </div>
  );
}

function RoundProgress({ game }: { game: GameState }) {
  const { t } = useLocalization();
  return (
    <div className="result-progress" aria-label={`${t("scoreByRounds")}: ${game.roundWins[1]} : ${game.roundWins[2]}`}>
      {([1, 2] as Player[]).map((player) => (
        <div className={`result-progress-player ${game.roundWinner === player ? "latest-winner" : ""}`} key={player}>
          <Figure player={player} small />
          <div>
            <strong>{player === 1 ? t("crosses") : t("circles")}</strong>
            <span>{t("wonCount")} {game.roundWins[player]} {t("of")} {ROUNDS_TO_WIN}</span>
          </div>
          <div className="result-win-marks" aria-hidden="true">
            {Array.from({ length: ROUNDS_TO_WIN }, (_, index) => <i className={index < game.roundWins[player] ? "won" : ""} key={index} />)}
          </div>
        </div>
      ))}
    </div>
  );
}

export function ResultModal({ game, status, viewer, onContinue, onMenu }: ResultModalProps) {
  const { t } = useLocalization();
  if (game.phase !== "round-over" && game.phase !== "game-over") return null;
  const winner = game.phase === "game-over" ? game.gameWinner : game.roundWinner;
  const headline = viewer && winner
    ? winner === viewer
      ? game.phase === "game-over" ? t("victory") : t("roundVictory")
      : game.phase === "game-over" ? t("defeat") : t("roundDefeat")
    : status;
  return (
    <div className={`modal-backdrop result-backdrop ${winner ? `winner-${winner}` : "draw"}`} role="presentation">
      <section className="result-modal" role="dialog" aria-modal="true" aria-labelledby="result-title">
        <span className="eyebrow">{game.phase === "game-over" ? t("matchComplete") : `${t("round")} ${game.completedRounds}`}</span>
        <ResultAnimation winner={winner} />
        <h2 id="result-title">{headline}</h2>
        {headline !== status && <p className="result-verdict-detail">{status}</p>}
        <RoundProgress game={game} />
        {game.phase === "round-over" && <p className="result-next-round">{t("nextChallenge")}: {3 + game.completedRounds}×{3 + game.completedRounds}, {t("mana")} — {3 + game.completedRounds}</p>}
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
