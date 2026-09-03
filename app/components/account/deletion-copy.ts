export const deletionCopy = {
  ru: {
    title: "Удалить аккаунт", start: "Удалить игровой аккаунт", load: "Проверяем аккаунт…",
    warning: "Будут безвозвратно удалены профиль, коллекция, колода, валюта и история операций. Все устройства выйдут из аккаунта. Сам Google-аккаунт не удаляется.",
    code: "Для подтверждения введите код этого игрока", confirm: "Подтвердить и удалить навсегда",
    google: "Подтвердить владельца через Google", googleHint: "Вход только подтверждает владельца. Удаление начнётся после нажатия отдельной кнопки ниже.",
    signIn: "Найти свой аккаунт через Google", signInHint: "Выберите Google-аккаунт, который привязан к игре. Новый игровой аккаунт здесь не создаётся.",
    cancel: "Отмена", done: "Игровой аккаунт удалён. Все его сессии отозваны.",
    restart: "Вернуться в игру", busy: "Удаляем…", localError: "Данные на сервере удалены, но очистить кеш устройства не удалось. Закройте игру и очистите её данные в настройках устройства.",
  },
  en: {
    title: "Delete account", start: "Delete game account", load: "Checking account…",
    warning: "Your profile, collection, deck, currencies and transaction history will be permanently deleted. All devices will be signed out. Your Google account will not be deleted.",
    code: "Type this player's code to confirm", confirm: "Confirm and permanently delete",
    google: "Verify ownership with Google", googleHint: "Signing in only verifies ownership. Deletion starts after pressing the separate button below.",
    signIn: "Find my account with Google", signInHint: "Choose the Google account linked to your game. No new game account is created here.",
    cancel: "Cancel", done: "Your game account has been deleted and all its sessions revoked.",
    restart: "Return to game", busy: "Deleting…", localError: "Server data was deleted, but the device cache could not be cleared. Close the game and clear its data in device settings.",
  },
};

export function deletionError(error: unknown, english: boolean): string {
  const code = error instanceof Error ? error.message : "";
  const messages: Record<string, [string, string]> = {
    unauthorized: ["Нет действующей сессии. Войдите через Google на странице удаления или повторите после подключения к сети.", "No valid session. Use Google on the deletion page or retry when online."],
    "account-not-found": ["К этому Google-аккаунту не привязан игровой профиль. Возможно, он уже удалён.", "No game profile is linked to this Google account. It may already have been deleted."],
    "google-verification-required": ["Подтвердите удаление тем же Google-аккаунтом, который привязан к этому игроку.", "Verify with the same Google account linked to this player."],
    "deletion-expired": ["Подтверждение истекло или уже использовано. Начните заново; повторный запрос не удалит другой аккаунт.", "Confirmation expired or was already used. Start again; a retry cannot delete another account."],
    "rate-limited": ["Слишком много попыток. Повторите через 10 минут.", "Too many attempts. Retry in 10 minutes."],
  };
  return messages[code]?.[english ? 1 : 0] ?? (english
    ? "Could not confirm the result. Check your connection and retry."
    : "Не удалось подтвердить результат. Проверьте соединение и повторите.");
}
