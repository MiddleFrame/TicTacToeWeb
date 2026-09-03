export class AdminRequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export async function adminRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: "same-origin",
    cache: "no-store",
    headers: { ...(init.body ? { "Content-Type": "application/json" } : {}), ...init.headers },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string } | null;
    throw new AdminRequestError(body?.error ?? "request-failed", response.status);
  }
  return response.json() as Promise<T>;
}

export function adminErrorMessage(error: unknown): string {
  if (error instanceof AdminRequestError) {
    if (error.message === "admin-disabled") return "Доступ к админке ещё не настроен на сервере.";
    if (error.status === 401) return "Войди через Google. Сессия отсутствует или истекла.";
    if (error.status === 403) return "У этого аккаунта нет доступа к админке.";
    if (error.status === 429) return "Слишком много запросов. Подожди минуту и повтори.";
    if (error.status === 404) return "Аккаунт не найден.";
  }
  return "Не удалось выполнить запрос. Проверь подключение и повтори.";
}
