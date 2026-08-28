"use client";

import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core";
import { useCallback, useEffect, useState } from "react";

type RewardedAdStatus = {
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
  getStatus(): Promise<RewardedAdStatus>;
  showRewarded(): Promise<RewardedAdResult>;
};

const RewardedAds = registerPlugin<RewardedAdsPlugin>("RewardedAds");

const initialStatus: RewardedAdStatus = {
  initialized: false,
  loaded: false,
  loading: true,
};

export function useRewardedAd(onReward: () => void) {
  const supported = Capacitor.getPlatform() === "android";
  const [status, setStatus] = useState(initialStatus);
  const [showing, setShowing] = useState(false);

  useEffect(() => {
    if (!supported) return;
    let listener: PluginListenerHandle | undefined;
    let active = true;
    RewardedAds.getStatus()
      .then((next) => {
        if (active) setStatus(next);
      })
      .catch(() => {
        if (active) setStatus({ initialized: false, loaded: false, loading: false });
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

  const show = useCallback(async () => {
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

  return {
    loaded: status.loaded,
    loading: status.loading || !status.initialized,
    show,
    showing,
    supported,
  };
}
