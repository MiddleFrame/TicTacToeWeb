"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import type { AdminAccount, AdminAccountDetail } from "../backend/admin-data";
import AccountDetail from "./AccountDetail";
import GoogleAdminSignIn from "./GoogleAdminSignIn";
import { adminErrorMessage, adminRequest, AdminRequestError } from "./admin-client";
import styles from "./admin.module.css";

type Session = { nickname: string; publicCode: string };

export default function AdminPanel() {
  const [admin, setAdmin] = useState<Session | null>(null);
  const [checking, setChecking] = useState(true);
  const [query, setQuery] = useState("");
  const [accounts, setAccounts] = useState<AdminAccount[]>([]);
  const [searched, setSearched] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [detail, setDetail] = useState<AdminAccountDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const revision = useRef(0);

  useEffect(() => {
    let active = true;
    adminRequest<{ admin: Session }>("/api/admin/session")
      .then((result) => { if (active) setAdmin(result.admin); })
      .catch((cause) => { if (active) setError(adminErrorMessage(cause)); })
      .finally(() => { if (active) setChecking(false); });
    return () => { active = false; };
  }, []);

  function failed(cause: unknown) {
    setError(adminErrorMessage(cause));
    if (cause instanceof AdminRequestError && (cause.status === 401 || cause.status === 403)) {
      setAdmin(null);
      setAccounts([]);
      setDetail(null);
    }
  }

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const current = ++revision.current;
    setBusy(true);
    setError("");
    setDetail(null);
    setAccounts([]);
    setSearched(false);
    try {
      const result = await adminRequest<{ accounts: AdminAccount[]; hasMore: boolean }>(`/api/admin/accounts?query=${encodeURIComponent(query.trim())}`);
      if (current !== revision.current) return;
      setAccounts(result.accounts);
      setHasMore(result.hasMore);
      setSearched(true);
    } catch (cause) {
      if (current === revision.current) failed(cause);
    } finally {
      if (current === revision.current) setBusy(false);
    }
  }

  async function openAccount(id: string) {
    const current = ++revision.current;
    setBusy(true);
    setError("");
    setDetail(null);
    try {
      const result = await adminRequest<AdminAccountDetail>(`/api/admin/accounts/${encodeURIComponent(id)}`);
      if (current === revision.current) setDetail(result);
    } catch (cause) {
      if (current === revision.current) failed(cause);
    } finally {
      if (current === revision.current) setBusy(false);
    }
  }

  async function signOut() {
    revision.current += 1;
    setBusy(true);
    try {
      const response = await fetch("/api/account", { method: "DELETE", credentials: "same-origin" });
      if (!response.ok) throw new Error("signout-failed");
      window.location.reload();
    } catch (cause) {
      failed(cause);
      setBusy(false);
    }
  }

  return <main className={styles.page}>
    <header className={styles.header}><div><Link href="/">← В игру</Link><h1>Администрирование</h1></div>
      <span className={styles.badge}>Только просмотр</span></header>
    <p>Аккаунты, инвентарь и журнал валюты. Без изменения балансов и выдачи наград.</p>
    {checking && <p role="status">Проверка доступа…</p>}
    {error && <p className={styles.error} role="alert">{error}</p>}
    {!checking && !admin && <div className={styles.panel}><GoogleAdminSignIn onSignedIn={() => window.location.reload()} /></div>}
    {admin && <>
      <div className={styles.session}><span>Вход: {admin.nickname} · {admin.publicCode}</span><button disabled={busy} onClick={() => void signOut()}>Выйти</button></div>
      <form className={styles.panel} onSubmit={(event) => void search(event)}>
        <label htmlFor="account-query">Публичный код, ID или точный ник</label>
        <div className={styles.search}><input id="account-query" value={query} onChange={(event) => setQuery(event.target.value)} minLength={2} maxLength={64} required autoComplete="off" spellCheck={false} />
          <button type="submit" disabled={busy || query.trim().length < 2}>Найти</button></div>
        <p>Поиск по точному совпадению, без учёта регистра только для публичного кода.</p>
      </form>
      {busy && <p role="status">Загрузка…</p>}
      {searched && !accounts.length && <p role="status">Ничего не найдено. Проверь код или полное написание ника.</p>}
      {hasMore && searched && <p>Показаны первые 20 совпадений. Уточни поиск публичным кодом.</p>}
      {!!accounts.length && <ul className={styles.results}>{accounts.map((account) => <li key={account.id}>
        <button disabled={busy} onClick={() => void openAccount(account.id)} aria-pressed={detail?.account.id === account.id}>
          <strong>{account.nickname}</strong><span>{account.publicCode} · {account.coins} монет</span>
        </button>
      </li>)}</ul>}
      {detail && <AccountDetail detail={detail} />}
    </>}
  </main>;
}
