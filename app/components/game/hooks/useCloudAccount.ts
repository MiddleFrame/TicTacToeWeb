import { useCallback, useEffect, useRef, useState } from "react";
import { connectGoogleAccount, getGoogleAccountState, initializePlayerProgress, sendCloudProgressOperation } from "../../../game/player-progress-client";
import { readProgressOperations } from "../../../game/progress-operation-queue";
import { flushProgressOperations } from "../../../game/progress-sync";
import { classifyProgressError, progressRetryDelay, type ProgressSyncState } from "../../../game/progress-request-error";
import type { PlayerProgressSnapshot } from "../../../game/player-progress";
import type { createAccountOperationGate } from "../../../game/account-operation-gate";

type Gate = ReturnType<typeof createAccountOperationGate>;

export function useCloudAccount(applyProgress: (progress: PlayerProgressSnapshot) => void, gate: Gate) {
  const [syncState, setSyncState] = useState<ProgressSyncState>("restoring");
  const stateRef = useRef<ProgressSyncState>("restoring");
  const [retryAt, setRetryAt] = useState<number | null>(null);
  const retries = useRef(0);
  const lifecycle = useRef(0);
  const active = useRef(false);
  const syncLock = useRef<Promise<boolean> | null>(null);
  const accountRecoveryRequired = useRef(false);
  const reconciliationState = useRef<"conflict" | "auth-required" | null>(null);
  const [google, setGoogle] = useState({ available: false, email: null as string | null, linked: false });
  const [googlePending, setGooglePending] = useState(false);
  const [googleError, setGoogleError] = useState(false);

  const updateState = useCallback((state: ProgressSyncState) => {
    stateRef.current = state;
    setSyncState(state);
  }, []);

  const synchronize = useCallback((): Promise<boolean> => {
    if (!active.current) return Promise.resolve(false);
    if (syncLock.current) return syncLock.current;
    const generation = lifecycle.current;
    const current = () => active.current && lifecycle.current === generation;
    const run = (async () => {
      if (!["conflict", "auth-required", "rate-limited"].includes(stateRef.current)) updateState("syncing");
      try {
        let progress = await initializePlayerProgress();
        if (!current()) return false;
        const account = await getGoogleAccountState().catch(() => null);
        do {
          progress = await flushProgressOperations(window.localStorage, progress, sendCloudProgressOperation, current);
          if (!current()) return false;
        } while (readProgressOperations(window.localStorage).length > 0);
        applyProgress(progress);
        updateState("ready");
        accountRecoveryRequired.current = false;
        reconciliationState.current = null;
        retries.current = 0;
        setRetryAt(null);
        if (current() && account) setGoogle(account);
        return current();
      } catch (error) {
        if (!current()) return false;
        const state = classifyProgressError(error);
        if (state === "conflict" || state === "auth-required") reconciliationState.current = state;
        updateState(reconciliationState.current ?? state);
        const delay = progressRetryDelay(error, retries.current++);
        setRetryAt(delay === null ? null : Date.now() + delay);
        accountRecoveryRequired.current ||= state === "auth-required" ||
          error instanceof Error && error.message === "account-progress-conflict";
        if (accountRecoveryRequired.current) {
          const account = await getGoogleAccountState().catch(() => null);
          if (current() && account) setGoogle(account);
        }
        return false;
      } finally {
        if (current()) syncLock.current = null;
      }
    })();
    syncLock.current = run;
    return run;
  }, [applyProgress, updateState]);

  const requestSync = useCallback(() => {
    if (gate.transitioning || ["conflict", "auth-required", "rate-limited"].includes(stateRef.current)) return;
    void synchronize();
  }, [gate, synchronize]);

  useEffect(() => {
    active.current = true;
    const generation = lifecycle.current;
    const reconnect = () => {
      if (stateRef.current !== "rate-limited") requestSync();
    };
    const foreground = () => { if (document.visibilityState === "visible") reconnect(); };
    window.addEventListener("online", reconnect);
    document.addEventListener("visibilitychange", foreground);
    return () => {
      active.current = false;
      lifecycle.current = generation + 1;
      syncLock.current = null;
      window.removeEventListener("online", reconnect);
      document.removeEventListener("visibilitychange", foreground);
    };
  }, [requestSync]);

  useEffect(() => {
    if (retryAt === null) return;
    const timer = window.setTimeout(() => {
      if (!gate.transitioning) void synchronize();
    }, Math.min(2_147_483_647, Math.max(0, retryAt - Date.now())));
    return () => window.clearTimeout(timer);
  }, [gate, retryAt, synchronize]);

  const assertMutable = useCallback(() => {
    gate.assertMutable();
    if (["conflict", "auth-required", "rate-limited"].includes(stateRef.current)) throw new Error("progress-reconciliation-required");
  }, [gate]);

  const connectGoogle = useCallback(async () => {
    if (!google.available) return;
    let release: (() => void) | undefined;
    try {
      release = gate.beginTransition();
      setGooglePending(true);
      setGoogleError(false);
      if (syncLock.current) await syncLock.current;
      const recovering = accountRecoveryRequired.current;
      if (!recovering && (!await synchronize() || readProgressOperations(window.localStorage).length > 0)) throw new Error("progress-sync-pending");
      if (!active.current) return;
      const generation = lifecycle.current;
      const connected = await connectGoogleAccount();
      if (!active.current || lifecycle.current !== generation) return;
      if (recovering) {
        if (!await synchronize()) throw new Error("progress-sync-pending");
      } else {
        applyProgress(connected.progress);
      }
      if (!active.current || lifecycle.current !== generation) return;
      setGoogle({ available: true, email: connected.email, linked: true });
      updateState("ready");
      accountRecoveryRequired.current = false;
      reconciliationState.current = null;
    } catch (error) {
      if (active.current) {
        setGoogleError(true);
        if (classifyProgressError(error) === "auth-required" ||
          error instanceof Error && error.message === "account-progress-conflict") {
          accountRecoveryRequired.current = true;
          const state = classifyProgressError(error) === "auth-required" ? "auth-required" : "conflict";
          reconciliationState.current = state;
          updateState(state);
          setRetryAt(null);
        }
      }
    } finally {
      if (release) {
        release();
        if (active.current) setGooglePending(false);
      }
    }
  }, [applyProgress, gate, google.available, synchronize, updateState]);

  return {
    assertMutable, connectGoogle, requestSync, synchronize, syncState,
    cloudReady: syncState === "ready", googleAvailable: google.available,
    googleEmail: google.email, googleLinked: google.linked, googlePending, googleError,
    mutationsBlocked: googlePending || ["conflict", "auth-required", "rate-limited"].includes(syncState),
  };
}
