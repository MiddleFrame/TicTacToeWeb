"use client";

import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core";
import { useCallback, useEffect, useRef, useState } from "react";
import type { RewardAttempt } from "../../../game/account-operation-gate";

type RewardedAdStatus = {
  privacyConfigured: boolean;
  initialized: boolean;
  loaded: boolean;
  loading: boolean;
};

type RewardedAdResult = {
  rewarded: boolean;
};

type RewardedAdsPlugin = {
  addListener(
    eventName: "stateChanged",
    listener: (status: RewardedAdStatus) => void,
  ): Promise<PluginListenerHandle>;
  configurePrivacy(options: { age: number; personalizedAds: boolean }): Promise<RewardedAdStatus>;
  getStatus(): Promise<RewardedAdStatus>;
  showRewarded(): Promise<RewardedAdResult>;
};

const RewardedAds = registerPlugin<RewardedAdsPlugin>("RewardedAds");

const initialStatus: RewardedAdStatus = {
  privacyConfigured: false,
  initialized: false,
  loaded: false,
  loading: false,
};

export function useRewardedAd(beginReward: () => RewardAttempt | null) {
  const supported = Capacitor.getPlatform() === "android";
  const [status, setStatus] = useState(initialStatus);
  const [showing, setShowing] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const showWhenLoaded = useRef(false);
  const active = useRef(false);
  const showLock = useRef(false);

  useEffect(() => {
    if (!supported) return;
    active.current = true;
    let listener: PluginListenerHandle | undefined;
    let listening = true;
    RewardedAds.getStatus()
      .then((next) => {
        if (listening) setStatus(next);
      })
      .catch(() => {
        if (listening) setStatus(initialStatus);
      });
    RewardedAds.addListener("stateChanged", (next) => {
      if (listening) setStatus(next);
    }).then((handle) => {
      if (listening) listener = handle;
      else void handle.remove();
    }).catch(() => undefined);
    return () => {
      listening = false;
      active.current = false;
      showWhenLoaded.current = false;
      if (listener) void listener.remove();
    };
  }, [supported]);

  const openAd = useCallback(async () => {
    if (!supported || !status.loaded || showLock.current || !active.current) return;
    const attempt = beginReward();
    if (!attempt) return;
    showLock.current = true;
    setShowing(true);
    try {
      const result = await RewardedAds.showRewarded();
      attempt.complete(result.rewarded);
    } catch {
      if (active.current) setStatus((current) => ({ ...current, loaded: false }));
    } finally {
      attempt.complete(false);
      showLock.current = false;
      if (active.current) setShowing(false);
    }
  }, [beginReward, status.loaded, supported]);

  useEffect(() => {
    if (!showWhenLoaded.current || !status.loaded || showing) return;
    showWhenLoaded.current = false;
    void openAd();
  }, [openAd, showing, status.loaded]);

  const show = useCallback(() => {
    if (!supported || showing) return;
    if (!status.privacyConfigured) {
      setPrivacyOpen(true);
      return;
    }
    void openAd();
  }, [openAd, showing, status.privacyConfigured, supported]);

  const configurePrivacy = useCallback(async (settings: {
    age: number;
    personalizedAds: boolean;
  }) => {
    if (!supported) return;
    setPrivacyOpen(false);
    showWhenLoaded.current = true;
    try {
      const next = await RewardedAds.configurePrivacy(settings);
      if (active.current) setStatus(next);
    } catch {
      showWhenLoaded.current = false;
      if (active.current) setStatus(initialStatus);
    }
  }, [supported]);

  return {
    loaded: status.loaded,
    loading: status.privacyConfigured && (status.loading || !status.initialized),
    closePrivacy: () => setPrivacyOpen(false),
    configurePrivacy,
    privacyConfigured: status.privacyConfigured,
    privacyOpen,
    show,
    showing,
    supported,
  };
}
