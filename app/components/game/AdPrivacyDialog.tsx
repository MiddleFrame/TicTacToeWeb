import { useState } from "react";
import { useLocalization } from "../../game/localization";

type AdPrivacyDialogProps = {
  onCancel: () => void;
  onConfirm: (settings: { age: number; personalizedAds: boolean }) => void;
};

export function AdPrivacyDialog({ onCancel, onConfirm }: AdPrivacyDialogProps) {
  const { language, t } = useLocalization();
  const [age, setAge] = useState(18);
  const personalizationAllowed = age >= 16;

  return (
    <div className="modal-backdrop ad-privacy-backdrop" role="presentation">
      <section
        className="ad-privacy-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ad-privacy-title"
      >
        <button className="ad-privacy-close" onClick={onCancel} aria-label={t("close")}>×</button>
        <span className="eyebrow">{t("adPrivacyEyebrow")}</span>
        <h2 id="ad-privacy-title">{t("adPrivacyTitle")}</h2>
        <p>{t("adPrivacyDescription")}</p>
        <label className="ad-age-control">
          <span>{t("adAge")}</span>
          <strong>{age}</strong>
          <input
            type="range"
            min="1"
            max="100"
            value={age}
            onChange={(event) => setAge(Number(event.target.value))}
          />
        </label>
        {!personalizationAllowed && <p className="ad-privacy-note">{t("adMinorNotice")}</p>}
        <div className="ad-privacy-actions">
          <button
            className="primary-button"
            onClick={() => onConfirm({ age, personalizedAds: personalizationAllowed })}
            disabled={!personalizationAllowed}
          >
            {t("adPersonalized")}
          </button>
          <button
            className="secondary-button"
            onClick={() => onConfirm({ age, personalizedAds: false })}
          >
            {t("adNonPersonalized")}
          </button>
        </div>
        <a
          className="ad-privacy-link"
          href="https://tic-tac-toe-plus-alpha.stofs.chatgpt.site/privacy"
          target="_blank"
          rel="noreferrer"
        >
          {language === "ru" ? "Политика конфиденциальности" : "Privacy policy"}
        </a>
      </section>
    </div>
  );
}
