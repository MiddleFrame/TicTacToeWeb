import { Component, Suspense, type ReactNode } from "react";
import { useLocalization } from "../../game/localization";

class ScreenBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function ScreenStatus({ failed = false, onBack }: { failed?: boolean; onBack: () => void }) {
  const { language, t } = useLocalization();
  const message = failed
    ? language === "ru" ? "Не удалось открыть экран. Попробуйте обновить игру." : "This screen could not open. Try reloading the game."
    : language === "ru" ? "Открываем экран…" : "Opening screen…";
  return (
    <main className="store-shell">
      <button className="back-button" onClick={onBack}>{t("back")}</button>
      <p role={failed ? "alert" : "status"}>{message}</p>
      {failed && <button className="secondary-button" onClick={() => window.location.reload()}>{language === "ru" ? "Обновить игру" : "Reload game"}</button>}
    </main>
  );
}

export function DeferredScreen({ children, onBack }: { children: ReactNode; onBack: () => void }) {
  return (
    <ScreenBoundary fallback={<ScreenStatus failed onBack={onBack} />}>
      <Suspense fallback={<ScreenStatus onBack={onBack} />}>{children}</Suspense>
    </ScreenBoundary>
  );
}
