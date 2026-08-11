import type { CSSProperties } from "react";
import type { Player } from "../../game/engine";

export function Figure({ player, small = false, className = "", style }: { player: Player; small?: boolean; className?: string; style?: CSSProperties }) {
  return (
    <span
      className={`figure figure-${player === 1 ? "x" : "o"} ${small ? "figure-small" : ""} ${className}`}
      style={style}
      aria-hidden="true"
    />
  );
}

export function SoundIcon({ muted }: { muted: boolean }) {
  return (
    <svg className="sound-icon" viewBox="0 0 64 64" aria-hidden="true">
      <path d="M8 25h12L35 12v40L20 39H8z" />
      {muted ? (
        <path d="m43 23 13 18m0-18L43 41" />
      ) : (
        <>
          <path d="M43 23c5 5 5 13 0 18" />
          <path d="M49 16c10 9 10 23 0 32" />
        </>
      )}
    </svg>
  );
}
