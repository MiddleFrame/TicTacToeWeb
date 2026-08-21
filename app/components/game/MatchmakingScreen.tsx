import type { PhotonSnapshot } from "../../game/photon";
import { useLocalization } from "../../game/localization";

type MatchmakingScreenProps = {
  network: PhotonSnapshot;
  onBot: () => void;
  onMenu: () => void;
};

const CELL_MARKS = ["×", "○", "×", "○", "×", "○", "×", "○", "×"];

function MatchmakingAnimation({ failed }: { failed: boolean }) {
  return (
    <div className={`matchmaking-animation ${failed ? "is-paused" : ""}`} aria-hidden="true">
      <div className="matchmaking-radar">
        <i />
        <i />
        <i />
      </div>
      <div className="matchmaking-board">
        {CELL_MARKS.map((mark, index) => (
          <span className="matchmaking-cell" key={index}>{mark}</span>
        ))}
        <span className="matchmaking-token matchmaking-token-x">×</span>
        <span className="matchmaking-token matchmaking-token-o">○</span>
        <span className="matchmaking-target" />
      </div>
    </div>
  );
}

export function MatchmakingScreen({ network, onBot, onMenu }: MatchmakingScreenProps) {
  const { t } = useLocalization();
  const failed = network.phase === "error";
  const waiting = network.phase === "waiting";
  const title = failed ? t("connectFailed") : waiting ? t("waitingOpponent") : t("searchingOpponent");
  const description = network.error || (waiting ? t("roomCreated") : t("searchingMatch"));

  return (
    <main className={`matchmaking-screen ${failed ? "is-error" : ""}`}>
      <section className="matchmaking-panel" aria-live="polite" aria-labelledby="matchmaking-title">
        <span className="matchmaking-eyebrow">{t("multiplayer")}</span>
        <MatchmakingAnimation failed={failed} />
        <div className="matchmaking-copy">
          <h1 id="matchmaking-title">{title}</h1>
          <p>{description}</p>
        </div>
        <div className="matchmaking-actions">
          <button className="matchmaking-action" onClick={onBot}>{t("bot")}</button>
          <button className="matchmaking-action" onClick={onMenu}>{t("returnMenu")}</button>
        </div>
      </section>
    </main>
  );
}
