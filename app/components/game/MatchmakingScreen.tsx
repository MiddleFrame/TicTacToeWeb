import { useState, type CSSProperties } from "react";
import type { PhotonSnapshot } from "../../game/photon";
import { useLocalization } from "../../game/localization";
import {
  type MatchmakingMark,
  type MatchmakingResolution,
  type MatchmakingTokenPoint,
  useMatchmakingAnimation,
} from "./hooks/useMatchmakingAnimation";

type MatchmakingScreenProps = {
  network: PhotonSnapshot;
  onBot: () => void;
  onMenu: () => void;
};

const BOARD_MARK_SIZE = 0.62;

type CometAxis = "vertical" | "horizontal";

type CometFlight = {
  cycle: number;
  delay: number;
  duration: number;
  reverse: boolean;
};

function randomCometDuration() {
  return 750 + Math.random() * 1750;
}

function MatchmakingComet({
  axis,
  order,
  reverse,
  duration,
  delay,
}: {
  axis: CometAxis;
  order: "first" | "second";
  reverse: boolean;
  duration: number;
  delay: number;
}) {
  const [flight, setFlight] = useState<CometFlight>({ cycle: 0, delay, duration, reverse });
  const gradientDirection = axis === "horizontal"
    ? flight.reverse ? "270deg" : "90deg"
    : flight.reverse ? "0deg" : "180deg";
  const style = {
    "--comet-delay": `${flight.delay}ms`,
    "--comet-direction": gradientDirection,
    "--comet-duration": `${flight.duration}ms`,
    "--comet-travel": flight.reverse ? "reverse" : "normal",
  } as CSSProperties;
  const startNextFlight = () => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setFlight((current) => ({
      cycle: current.cycle + 1,
      delay: 0,
      duration: randomCometDuration(),
      reverse: !current.reverse,
    }));
  };

  return (
    <span className={`matchmaking-grid-line is-${axis} is-${order}`} style={style}>
      <i className="matchmaking-grid-comet" key={flight.cycle} onAnimationEnd={startNextFlight} />
    </span>
  );
}

function MarkLayer({ mark, className }: { mark: MatchmakingMark; className: string }) {
  return (
    <span className={className}>
      <i />
      {mark === "x" && <i />}
    </span>
  );
}

function MarkShape({ mark, filled = false }: { mark: MatchmakingMark; filled?: boolean }) {
  return (
    <span className={`matchmaking-mark-shape is-${mark} ${filled ? "is-filled" : ""}`}>
      <MarkLayer mark={mark} className="matchmaking-mark-outline" />
      <MarkLayer mark={mark} className="matchmaking-mark-fill" />
    </span>
  );
}

function getCollectStyle(index: number, target: MatchmakingTokenPoint): CSSProperties {
  const column = index % 3;
  const row = Math.floor(index / 3);
  return {
    "--collect-x": `${(target.x * 3 - (column + 0.5) * 100) / BOARD_MARK_SIZE}%`,
    "--collect-y": `${(target.y * 3 - (row + 0.5) * 100) / BOARD_MARK_SIZE}%`,
  } as CSSProperties;
}

function BoardMark({
  index,
  mark,
  resolution,
  target,
}: {
  index: number;
  mark: MatchmakingMark;
  resolution: MatchmakingResolution | null;
  target: MatchmakingTokenPoint;
}) {
  const collected = resolution?.cells.includes(index) ?? false;
  return (
    <span
      className={`matchmaking-cell-mark ${resolution ? "is-resolving" : ""} ${collected ? "is-collected" : ""}`}
      style={getCollectStyle(index, target)}
    >
      <MarkShape mark={mark} filled />
      <span className="matchmaking-mark-ripple"><MarkShape mark={mark} /></span>
      <span className="matchmaking-mark-ripple"><MarkShape mark={mark} /></span>
    </span>
  );
}

function MatchmakingAnimation({ failed, matched }: { failed: boolean; matched: boolean }) {
  const { activeMark, board, drawing, resolution, tokenPoints } = useMatchmakingAnimation(failed, matched);
  return (
    <div className={`matchmaking-animation ${failed ? "is-failed" : ""} ${matched ? "is-matched" : ""}`} aria-hidden="true">
      <div className="matchmaking-board">
        <MatchmakingComet axis="vertical" order="first" reverse={false} duration={1000} delay={0} />
        <MatchmakingComet axis="vertical" order="second" reverse duration={1700} delay={240} />
        <MatchmakingComet axis="horizontal" order="first" reverse duration={1300} delay={480} />
        <MatchmakingComet axis="horizontal" order="second" reverse={false} duration={2200} delay={720} />
        <div className="matchmaking-cells">
          {board.map((mark, index) => (
            <span className="matchmaking-cell" key={index}>
              {mark && (
                <BoardMark
                  index={index}
                  mark={mark}
                  resolution={resolution}
                  target={tokenPoints[mark]}
                />
              )}
            </span>
          ))}
        </div>
        {(["x", "o"] as MatchmakingMark[]).map((mark) => (
          <span
            className={`matchmaking-token is-${mark} ${activeMark === mark ? "is-active" : ""} ${drawing?.mark === mark ? "is-painting" : ""}`}
            style={{ left: `${tokenPoints[mark].x}%`, top: `${tokenPoints[mark].y}%` }}
            key={mark}
          >
            <MarkShape mark={mark} />
          </span>
        ))}
        <span className="matchmaking-fusion">
          <span className="matchmaking-fusion-half is-x"><MarkShape mark="x" filled /></span>
          <span className="matchmaking-fusion-half is-o"><MarkShape mark="o" filled /></span>
        </span>
        <span className="matchmaking-connection-impact"><i /><i /><i /><i /></span>
      </div>
    </div>
  );
}

export function MatchmakingScreen({ network, onBot, onMenu }: MatchmakingScreenProps) {
  const { t } = useLocalization();
  const failed = network.phase === "error";
  const waiting = network.phase === "waiting";
  const matched = network.phase === "ready";
  const title = failed ? t("connectFailed") : matched ? t("opponentFound") : waiting ? t("waitingOpponent") : t("searchingOpponent");
  const description = failed ? t("connectionFailedHint") : matched ? t("startingMatch") : waiting ? t("roomCreated") : t("searchingMatch");

  return (
    <main className={`matchmaking-screen ${failed ? "is-error" : ""} ${matched ? "is-matched" : ""}`}>
      <section className="matchmaking-panel" aria-live="polite" aria-labelledby="matchmaking-title">
        <span className="matchmaking-eyebrow">{t("multiplayer")}</span>
        <MatchmakingAnimation failed={failed} matched={matched} />
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
