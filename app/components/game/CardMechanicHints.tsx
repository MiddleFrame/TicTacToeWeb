import { mechanicsForCard } from "../../game/card-mechanics";
import type { CardKind } from "../../game/cards";
import { useLocalization } from "../../game/localization";

type CardMechanicHintsProps = {
  kind: CardKind | null;
  visible: boolean;
};

export function CardMechanicHints({ kind, visible }: CardMechanicHintsProps) {
  const { mechanic, t } = useLocalization();
  const mechanics = kind ? mechanicsForCard(kind) : [];
  return visible && mechanics.length > 0 ? (
    <aside className="card-mechanic-hints" role="status" aria-label={t("mechanics")}>
      <strong>{t("mechanics")}</strong>
      <div>
        {mechanics.map((item) => {
          const copy = mechanic(item);
          return (
            <section key={item}>
              <b>{copy.name}</b>
              <span>{copy.description}</span>
            </section>
          );
        })}
      </div>
    </aside>
  ) : null;
}
