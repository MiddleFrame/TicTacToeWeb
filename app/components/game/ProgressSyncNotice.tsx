import { useLocalization } from "../../game/localization";
import type { ProgressSyncState } from "../../game/progress-request-error";

const copy = {
  ru: {
    restoring: "Загружаем сохранённый прогресс…",
    syncing: "Синхронизируем прогресс…",
    conflict: "Не удалось согласовать прогресс с сервером. Сохранённые действия остаются на устройстве; покупки временно приостановлены.",
    "auth-required": "Нужно восстановить вход в аккаунт. Сохранённые действия остаются на устройстве; покупки временно приостановлены.",
    "rate-limited": "Сервер временно ограничил начисления. Сохранённые действия будут отправлены повторно позже.",
    retry: "Проверить синхронизацию",
  },
  en: {
    restoring: "Loading saved progress…",
    syncing: "Syncing progress…",
    conflict: "Progress needs reconciliation with the server. Saved actions remain on this device; purchases are temporarily paused.",
    "auth-required": "Account sign-in needs recovery. Saved actions remain on this device; purchases are temporarily paused.",
    "rate-limited": "The server temporarily limited rewards. Saved actions will be retried later.",
    retry: "Check sync",
  },
};

export function ProgressSyncNotice({ state, onRetry }: { state: ProgressSyncState; onRetry: () => void }) {
  const { language } = useLocalization();
  if (state === "ready" || state === "offline") return null;
  return <div role="status">
    <p>{copy[language][state]}</p>
    {(state === "conflict" || state === "auth-required") && <button className="secondary-button" onClick={onRetry}>{copy[language].retry}</button>}
  </div>;
}
