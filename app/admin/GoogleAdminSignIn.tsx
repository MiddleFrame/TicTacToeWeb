"use client";

import { useRef, useState } from "react";
import { adminErrorMessage, adminRequest, AdminRequestError } from "./admin-client";
import { googleIdentity, loadGoogle } from "../components/account/google-browser";

async function prepareSession() {
  try {
    await adminRequest("/api/account");
  } catch (error) {
    if (!(error instanceof AdminRequestError) || error.status !== 401) throw error;
    await adminRequest("/api/account/guest", { method: "POST" });
  }
  return adminRequest<{ configured: boolean; clientId: string | null; nonce: string | null }>("/api/account/google");
}

export default function GoogleAdminSignIn({ onSignedIn }: { onSignedIn: () => void }) {
  const container = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");

  async function signIn(credential: string) {
    setBusy(true);
    setError("");
    try {
      await adminRequest("/api/account/google", { method: "POST", body: JSON.stringify({ idToken: credential }) });
      onSignedIn();
    } catch (cause) {
      setError(adminErrorMessage(cause));
      setReady(false);
      container.current?.replaceChildren();
    } finally {
      setBusy(false);
    }
  }

  async function prepare() {
    setBusy(true);
    setError("");
    try {
      const session = await prepareSession();
      if (!session.configured || !session.clientId || !session.nonce) {
        setError("Google-вход ещё не настроен на сервере.");
        return;
      }
      await loadGoogle();
      const identity = googleIdentity();
      if (!identity || !container.current) throw new Error("google-unavailable");
      identity.initialize({ client_id: session.clientId, nonce: session.nonce, callback: (result) => void signIn(result.credential) });
      identity.renderButton(container.current, { type: "standard", theme: "outline", size: "large", text: "signin_with" });
      setReady(true);
    } catch (cause) {
      setError(adminErrorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  return <section aria-label="Вход администратора">
    <p>Войди Google-аккаунтом, которому разрешён доступ. Пароль игра не получает.</p>
    {!ready && <button type="button" disabled={busy} onClick={() => void prepare()}>{busy ? "Подключение…" : "Войти через Google"}</button>}
    <div ref={container} />
    {ready && <p>Если Google отклоняет вход, проверь разрешённый адрес сайта в настройках OAuth.</p>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
