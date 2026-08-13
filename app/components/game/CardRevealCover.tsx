import type { CardRevealAccent } from "../../game/card-reveal-profile";

const CRACKS = Array.from({ length: 8 }, (_, index) => index);
const FRAGMENTS = Array.from({ length: 10 }, (_, index) => index);
const FOG_PARTICLES = Array.from({ length: 7 }, (_, index) => index);

type CardRevealCoverProps = {
  variant: CardRevealAccent;
};

export function CardRevealCover({ variant }: CardRevealCoverProps) {
  return (
    <span className={`purchase-card-cover cover-${variant}`} aria-hidden="true">
      <span className="purchase-card-cover-face">?</span>
      <span className="purchase-card-cover-cracks">
        {CRACKS.map((crack) => <span key={crack} />)}
      </span>
      <span className="purchase-card-cover-fragments">
        {FRAGMENTS.map((fragment) => <span key={fragment} />)}
      </span>
      <span className="purchase-card-cover-fog">
        {FOG_PARTICLES.map((particle) => <span key={particle} />)}
      </span>
    </span>
  );
}
