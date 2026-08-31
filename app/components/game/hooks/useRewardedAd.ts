"use client";

import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core";
import { useCallback, useEffect, useRef, useState } from "react";

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

export function useRewardedAd(onReward: () => void) {
  const supported = Capacitor.getPlatform() === "android";
  const [status, setStatus] = useState(initialStatus);
  const [showing, setShowing] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const showWhenLoaded = useRef(false);

  useEffect(() => {
    if (!supported) return;
    let listener: PluginListenerHandle | undefined;
    let active = true;
    RewardedAds.getStatus()
      .then((next) => {
        if (active) setStatus(next);
      })
      .catch(() => {
        if (active) setStatus(initialStatus);
      });
    RewardedAds.addListener("stateChanged", (next) => {
      if (active) setStatus(next);
    }).then((handle) => {
      if (active) listener = handle;
      else void handle.remove();
    });
    return () => {
      active = false;
      if (listener) void listener.remove();
    };
  }, [supported]);

  const openAd = useCallback(async () => {
    if (!supported || !status.loaded || showing) return;
    setShowing(true);
    try {
      const result = await RewardedAds.showRewarded();
      if (result.rewarded) onReward();
    } catch {
      setStatus((current) => ({ ...current, loaded: false }));
    } finally {
      setShowing(false);
    }
  }, [onReward, showing, status.loaded, supported]);

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
      setStatus(next);
    } catch {
      showWhenLoaded.current = false;
      setStatus(initialStatus);
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
