"use client";

import { useState } from "react";
import { apiRequest, clearDeletedAccount, confirmNativeGoogleIdentity, isNativeAccountClient } from "../../game/player-progress-client";
import { GoogleCredentialButton } from "./GoogleCredentialButton";
import { deletionCopy, deletionError } from "./deletion-copy";
import styles from "./deletion.module.css";

type Account = { publicCode: string; nickname: string };
type Context = { account: Account; googleRequired: boolean; nonce: string; clientId: string | null };
type Proof = { account: Account; ticket: string };

export function AccountDeletionPanel({ external = false, english = false }: { external?: boolean; english?: boolean }) {
  const t = deletionCopy[english ? "en" : "ru"];
  const [context, setContext] = useState<Context | null>(null);
  const [proof, setProof] = useState<Proof | null>(null);
  const [credential, setCredential] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [clearLocal, setClearLocal] = useState(false);
  const [error, setError] = useState("");
  const account = proof?.account ?? context?.account;
  const native = isNativeAccountClient();
  const reportError = (cause: unknown) => setError(deletionError(cause, english));

  function reset() {
    setContext(null); setProof(null); setCredential(""); setCode(""); setError("");
  }

  async function open() {
    setBusy(true); setError("");
    try { setContext(await apiRequest<Context>("/api/account/deletion")); }
    catch (cause) { reportError(cause); }
    finally { setBusy(false); }
  }

  async function remove() {
    if (!account || code !== account.publicCode || busy) return;
    setBusy(true); setError("");
    try {
      let ticket = proof?.ticket;
      if (!ticket) {
        const idToken = context?.googleRequired && native
          ? await confirmNativeGoogleIdentity(context.nonce) : credential;
        const result = await apiRequest<{ ticket: string }>("/api/account/deletion", {
          method: "POST", body: JSON.stringify({ confirm: "DELETE", publicCode: code, idToken }),
        });
        ticket = result.ticket;
        setProof({ account, ticket });
      }
      const result = await apiRequest<{ clearLocalSession: boolean }>("/api/account/deletion", {
        method: "DELETE", body: JSON.stringify({ ticket, publicCode: code, confirm: "DELETE" }),
      });
      setDeleted(true);
      setClearLocal(!external || result.clearLocalSession);
      try { if (!external || result.clearLocalSession) await clearDeletedAccount(); }
      catch { setError(t.localError); }
    } catch (cause) { setCredential(""); reportError(cause); }
    finally { setBusy(false); }
  }

  if (deleted) return <section className={`${styles.panel} ${styles.finished}`}>
    <p role="status">{t.done}</p>
    {error && <p role="alert">{error}</p>}
    <button type="button" onClick={() => { void (clearLocal ? clearDeletedAccount() : Promise.resolve()).finally(() => window.location.assign(new URL("/", window.location.href).href)); }}>{t.restart}</button>
  </section>;

  return <section className={styles.panel} aria-label={t.title}>
    {!account && !external && <button type="button" disabled={busy} onClick={() => void open()}>{busy ? t.load : t.start}</button>}
    {!account && external && <>
      <p>{t.signInHint}</p>
      <GoogleCredentialButton label={t.signIn} onError={reportError}
        prepare={() => apiRequest("/api/account/deletion/google")}
        onCredential={async (idToken) => {
          const result = await apiRequest<Proof>("/api/account/deletion/google", { method: "POST", body: JSON.stringify({ idToken }) });
          setProof(result); setError("");
        }} />
    </>}
    {account && <>
      <h2>{t.title}</h2>
      <p><strong>{account.nickname}</strong> · {account.publicCode}</p>
      <p>{t.warning}</p>
      <label className={styles.label}>{t.code}: <strong>{account.publicCode}</strong>
        <input value={code} disabled={busy} onChange={(event) => setCode(event.target.value.toUpperCase().trim())} maxLength={10} autoComplete="off" autoCapitalize="characters" spellCheck={false} />
      </label>
      {context?.googleRequired && !native && !credential && !proof && <>
        <p>{t.googleHint}</p>
        <GoogleCredentialButton label={t.google} onError={reportError}
          prepare={async () => {
            const fresh = await apiRequest<Context>("/api/account/deletion");
            if (!fresh.clientId || fresh.account.publicCode !== account.publicCode) throw new Error("unauthorized");
            setContext(fresh);
            return { clientId: fresh.clientId, nonce: fresh.nonce };
          }} onCredential={async (value) => { setCredential(value); setError(""); }} />
      </>}
      <div className={styles.actions}>
        <button type="button" disabled={busy} onClick={reset}>{t.cancel}</button>
        <button type="button" className={styles.danger} disabled={busy || code !== account.publicCode || Boolean(context?.googleRequired && !native && !credential && !proof)} onClick={() => void remove()}>{busy ? t.busy : t.confirm}</button>
      </div>
    </>}
    {error && <p role="alert" className={styles.error}>{error}</p>}
  </section>;
}
