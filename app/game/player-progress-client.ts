"use client";

import { Capacitor, registerPlugin } from "@capacitor/core";
import type { CardKind } from "./cards";
import type { CardDrop } from "./card-purchase";
import type { XpAward } from "./element-progression";
import { PROGRESSION_VERSION } from "./progression-curve";
import type { PlayerProgressSnapshot } from "./player-progress";
import { adoptCloudAccount, clearAccountCache } from "./account-cache";
import type { ProgressOperation } from "./progress-operation-queue";
import { parseRetryAfter, ProgressRequestError } from "./progress-request-error";
import { withRequestDeadline } from "./request-timeout";

type SecureSessionPlugin = {
  getToken(): Promise<{ value: string | null }>;
  setToken(options: { value: string }): Promise<void>;
  removeToken(): Promise<void>;
};

type GoogleAuthPlugin = {
  isAvailable(): Promise<{ available: boolean }>;
  signIn(options: { nonce: string }): Promise<{ idToken: string }>;
};

type ProgressResponse = { progress: PlayerProgressSnapshot };
type PurchaseResponse = ProgressResponse & { purchasedKinds: CardKind[]; drops: CardDrop[]; awards: XpAward[] };
type GoogleAccountStatus = {
  configured: boolean;
  email: string | null;
  linked: boolean;
  nonce: string | null;
};

export type GoogleAccountState = {
  available: boolean;
  email: string | null;
  linked: boolean;
};

type GoogleAccountResponse = ProgressResponse & {
  email: string | null;
  linked: true;
  sessionToken?: string;
  switched: boolean;
};

const SecureSession = registerPlugin<SecureSessionPlugin>("SecureSession");
const GoogleAuth = registerPlugin<GoogleAuthPlugin>("GoogleAuth");
const android = Capacitor.getPlatform() === "android";
const configuredOrigin = process.env.NEXT_PUBLIC_API_ORIGIN?.trim().replace(/\/$/, "") ?? "";
const apiOrigin = android ? configuredOrigin : "";
let initializationPromise: Promise<PlayerProgressSnapshot> | null = null;
let accountCleared = false;
let sessionGeneration = 0;

async function sessionToken(): Promise<string | null> {
  if (!android) return null;
  try {
    return (await SecureSession.getToken()).value;
  } catch {
    return null;
  }
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (accountCleared) throw new ProgressRequestError("unauthorized", 401);
  if (android && !apiOrigin) throw new Error("api-unavailable");
  const generation = sessionGeneration;
  const token = await sessionToken();
  if (accountCleared || generation !== sessionGeneration) throw new ProgressRequestError("session-changed", 401);
  return withRequestDeadline(async (signal) => {
    const response = await fetch(`${apiOrigin}${path}`, {
      ...init,
      signal,
      credentials: android ? "omit" : "same-origin",
      headers: {
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        "X-TTTP-Progression": String(PROGRESSION_VERSION),
        ...(android ? { "X-TTTP-Client": "android" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
    });
    if (accountCleared || generation !== sessionGeneration) throw new ProgressRequestError("session-changed", 401);
    if (!response.ok) {
      const body = await response.json().catch(() => null) as { error?: string } | null;
      if (accountCleared || generation !== sessionGeneration) throw new ProgressRequestError("session-changed", 401);
      throw new ProgressRequestError(body?.error ?? `request-${response.status}`, response.status, parseRetryAfter(response.headers.get("Retry-After")));
    }
    const result = await response.json() as T;
    if (accountCleared || generation !== sessionGeneration) throw new ProgressRequestError("session-changed", 401);
    return result;
  }, init.signal);
}

async function createGuestSession(): Promise<void> {
  const response = await apiRequest<{ sessionToken?: string }>("/api/account/guest", {
    method: "POST",
  });
  if (!android) return;
  if (!response.sessionToken) throw new Error("native-session-missing");
  await replaceNativeSession(response.sessionToken);
}

async function replaceNativeSession(token: string): Promise<void> {
  const generation = ++sessionGeneration;
  await SecureSession.setToken({ value: token });
  if (accountCleared || generation !== sessionGeneration) throw new ProgressRequestError("session-changed", 401);
}

async function initialize(): Promise<PlayerProgressSnapshot> {
  let current: PlayerProgressSnapshot | null = null;
  try {
    current = (await apiRequest<ProgressResponse>("/api/progress")).progress;
  } catch (error) {
    if (!(error instanceof Error) || error.message !== "unauthorized") throw error;
    const previousAccount = window.localStorage.getItem("tttp-cloud-account");
    if (previousAccount) {
      throw new ProgressRequestError("account-session-expired", 401);
    }
    if (android) await SecureSession.removeToken().catch(() => undefined);
    await createGuestSession();
    current = (await apiRequest<ProgressResponse>("/api/progress")).progress;
  }
  if (!current) throw new Error("progress-unavailable");
  adoptCloudAccount(window.localStorage, current.accountId);
  return current;
}

export function initializePlayerProgress(): Promise<PlayerProgressSnapshot> {
  if (!initializationPromise) {
    const pending = initialize().finally(() => {
      if (initializationPromise === pending) initializationPromise = null;
    });
    initializationPromise = pending;
  }
  return initializationPromise;
}

export async function refreshCloudPlayerProgress(): Promise<PlayerProgressSnapshot> {
  return (await apiRequest<ProgressResponse>("/api/progress")).progress;
}

export async function saveCloudPlayerProgress(input: {
  nickname?: string;
  selectedKinds?: CardKind[];
}): Promise<PlayerProgressSnapshot> {
  return (await apiRequest<ProgressResponse>("/api/progress", {
    method: "PATCH",
    body: JSON.stringify(input),
  })).progress;
}

export async function purchaseCloudCardPack(
  count: number,
  collectionId: string,
  operationId = crypto.randomUUID(),
  version: number = PROGRESSION_VERSION,
): Promise<PurchaseResponse> {
  return apiRequest<PurchaseResponse>("/api/store/purchase", {
    method: "POST",
    body: JSON.stringify({ count, collectionId, operationId, progressionVersion: version }),
  });
}

export async function cloudProgressionAction(input: Record<string, unknown>, operationId = crypto.randomUUID()) {
  return apiRequest<ProgressResponse & { awards?: XpAward[] }>("/api/progression", {
    method: "POST",
    body: JSON.stringify({ ...input, operationId }),
  });
}

export async function grantCloudAdReward(
  operationId: string,
): Promise<PlayerProgressSnapshot> {
  return (await apiRequest<ProgressResponse>("/api/rewards/ad", {
    method: "POST",
    body: JSON.stringify({ operationId }),
  })).progress;
}

export async function sendCloudProgressOperation(operation: ProgressOperation): Promise<ProgressResponse> {
  if (operation.type === "purchase") {
    return purchaseCloudCardPack(operation.count, operation.collectionId, operation.id, operation.progressionVersion ?? 1);
  }
  if (operation.type === "reward-ad") {
    return { progress: await grantCloudAdReward(operation.id) };
  }
  if (operation.type === "progression") {
    return cloudProgressionAction(operation.input, operation.id);
  }
  return { progress: await saveCloudPlayerProgress(operation.input) };
}

export async function getGoogleAccountState(): Promise<GoogleAccountState> {
  let status: GoogleAccountStatus;
  try {
    status = await apiRequest<GoogleAccountStatus>("/api/account/google");
  } catch (error) {
    if (accountCleared || !android || !(error instanceof ProgressRequestError) || error.message !== "unauthorized") throw error;
    const native = await GoogleAuth.isAvailable().catch(() => ({ available: false }));
    return { available: native.available, email: null, linked: false };
  }
  if (!android) return { available: false, email: status.email, linked: status.linked };
  const native = await GoogleAuth.isAvailable().catch(() => ({ available: false }));
  return {
    available: status.linked || status.configured && native.available,
    email: status.email,
    linked: status.linked,
  };
}

export async function connectGoogleAccount(): Promise<GoogleAccountResponse> {
  if (!android) throw new Error("google-auth-unavailable");
  let status: GoogleAccountStatus;
  try {
    status = await apiRequest<GoogleAccountStatus>("/api/account/google");
  } catch (error) {
    if (accountCleared || !(error instanceof ProgressRequestError) || error.message !== "unauthorized") throw error;
    await createGuestSession();
    status = await apiRequest<GoogleAccountStatus>("/api/account/google");
  }
  if (!status.configured || !status.nonce) {
    throw new Error("google-auth-unavailable");
  }
  const credential = await GoogleAuth.signIn({ nonce: status.nonce });
  const connected = await apiRequest<GoogleAccountResponse>("/api/account/google", {
    method: "POST",
    body: JSON.stringify({ idToken: credential.idToken }),
  });
  if (!connected.sessionToken) throw new Error("native-session-missing");
  await replaceNativeSession(connected.sessionToken);
  initializationPromise = null;
  adoptCloudAccount(window.localStorage, connected.progress.accountId);
  return connected;
}

export function isNativeAccountClient(): boolean {
  return android;
}

export async function confirmNativeGoogleIdentity(nonce: string): Promise<string> {
  return (await GoogleAuth.signIn({ nonce })).idToken;
}

export async function clearDeletedAccount(): Promise<void> {
  accountCleared = true;
  sessionGeneration++;
  initializationPromise = null;
  clearAccountCache(window.localStorage);
  if (android) await SecureSession.removeToken();
}
