"use client";

import { Capacitor, registerPlugin } from "@capacitor/core";
import type { CardKind } from "./cards";
import type { LocalProgressSnapshot, PlayerProgressSnapshot } from "./player-progress";

type SecureSessionPlugin = {
  getToken(): Promise<{ value: string | null }>;
  setToken(options: { value: string }): Promise<void>;
  removeToken(): Promise<void>;
};

type ProgressResponse = { progress: PlayerProgressSnapshot };
type PurchaseResponse = ProgressResponse & { purchasedKinds: CardKind[] };

const SecureSession = registerPlugin<SecureSessionPlugin>("SecureSession");
const android = Capacitor.getPlatform() === "android";
const configuredOrigin = process.env.NEXT_PUBLIC_API_ORIGIN?.trim().replace(/\/$/, "") ?? "";
const apiOrigin = android ? configuredOrigin : "";
let initializationPromise: Promise<PlayerProgressSnapshot> | null = null;

async function sessionToken(): Promise<string | null> {
  if (!android) return null;
  try {
    return (await SecureSession.getToken()).value;
  } catch {
    return null;
  }
}

async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (android && !apiOrigin) throw new Error("api-unavailable");
  const token = await sessionToken();
  const response = await fetch(`${apiOrigin}${path}`, {
    ...init,
    credentials: android ? "omit" : "same-origin",
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(android ? { "X-TTTP-Client": "android" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(body?.error ?? `request-${response.status}`);
  }
  return response.json() as Promise<T>;
}

async function createGuestSession(): Promise<void> {
  const response = await apiRequest<{ sessionToken?: string }>("/api/account/guest", {
    method: "POST",
  });
  if (!android) return;
  if (!response.sessionToken) throw new Error("native-session-missing");
  await SecureSession.setToken({ value: response.sessionToken });
}

async function initialize(local: LocalProgressSnapshot): Promise<PlayerProgressSnapshot> {
  let current: PlayerProgressSnapshot | null = null;
  try {
    current = (await apiRequest<ProgressResponse>("/api/progress")).progress;
  } catch (error) {
    if (!(error instanceof Error) || error.message !== "unauthorized") throw error;
    if (android) await SecureSession.removeToken().catch(() => undefined);
    await createGuestSession();
  }
  const imported = await apiRequest<ProgressResponse>("/api/progress/import", {
    method: "POST",
    body: JSON.stringify(local),
  });
  return imported.progress ?? current;
}

export function initializePlayerProgress(
  local: LocalProgressSnapshot,
): Promise<PlayerProgressSnapshot> {
  initializationPromise ??= initialize(local).catch((error) => {
    initializationPromise = null;
    throw error;
  });
  return initializationPromise;
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
  operationId = crypto.randomUUID(),
): Promise<PurchaseResponse> {
  return apiRequest<PurchaseResponse>("/api/store/purchase", {
    method: "POST",
    body: JSON.stringify({ count, operationId }),
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
