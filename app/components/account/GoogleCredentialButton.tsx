"use client";

import { useEffect, useRef, useState } from "react";
import { googleIdentity, loadGoogle } from "./google-browser";

type Props = {
  prepare: () => Promise<{ clientId: string; nonce: string }>;
  onCredential: (credential: string) => Promise<void>;
  onError: (error: unknown) => void;
  label: string;
};

export function GoogleCredentialButton({ prepare, onCredential, onError, label }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const active = useRef(true);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);

  async function start() {
    setBusy(true);
    try {
      const options = await prepare();
      await loadGoogle();
      const identity = googleIdentity();
      if (!active.current || !container.current) return;
      if (!identity) throw new Error("google-auth-unavailable");
      identity.initialize({ client_id: options.clientId, nonce: options.nonce, callback: ({ credential }) => {
        if (!active.current) return;
        setBusy(true);
        void onCredential(credential).catch(onError).finally(() => {
          if (!active.current) return;
          setBusy(false);
          setReady(false);
          container.current?.replaceChildren();
        });
      } });
      identity.renderButton(container.current, { type: "standard", theme: "outline", size: "large", text: "signin_with" });
      setReady(true);
    } catch (error) {
      onError(error);
    } finally {
      if (active.current) setBusy(false);
    }
  }

  return <div>
    {!ready && <button type="button" disabled={busy} onClick={() => void start()}>{label}</button>}
    <div ref={container} hidden={busy} />
    {busy && <span role="status">…</span>}
  </div>;
}
