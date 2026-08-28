package com.MiddleFrame.Tictactoe;

import androidx.annotation.NonNull;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.yodo1.mas.Yodo1Mas;
import com.yodo1.mas.Yodo1MasSdkConfiguration;
import com.yodo1.mas.error.Yodo1MasError;
import com.yodo1.mas.helper.model.Yodo1MasAdBuildConfig;
import com.yodo1.mas.reward.Yodo1MasRewardAd;
import com.yodo1.mas.reward.Yodo1MasRewardAdListener;

@CapacitorPlugin(name = "RewardedAds")
public class RewardedAdsPlugin extends Plugin implements Yodo1MasRewardAdListener {
    private static final String PLACEMENT = "store_reward_50";
    private boolean initialized;
    private boolean loading;
    private boolean rewardEarned;
    private PluginCall pendingCall;

    @Override
    public void load() {
        Yodo1MasRewardAd rewardAd = Yodo1MasRewardAd.getInstance();
        rewardAd.setAdListener(this);
        rewardAd.autoDelayIfLoadFail = true;
        Yodo1MasAdBuildConfig config = new Yodo1MasAdBuildConfig.Builder()
            .enableUserPrivacyDialog(true)
            .build();
        Yodo1Mas.getInstance().setAdBuildConfig(config);
        Yodo1Mas.getInstance().initMas(
            getActivity(),
            getActivity().getString(R.string.yodo_mas_app_key),
            new Yodo1Mas.InitListener() {
                @Override
                public void onMasInitSuccessful() {
                    finishInitialization();
                }

                @Override
                public void onMasInitSuccessful(Yodo1MasSdkConfiguration configuration) {
                    finishInitialization();
                }

                @Override
                public void onMasInitFailed(@NonNull Yodo1MasError error) {
                    loading = false;
                    notifyState();
                }
            }
        );
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        call.resolve(status());
    }

    @PluginMethod
    public void showRewarded(PluginCall call) {
        if (pendingCall != null) {
            call.reject("Rewarded ad is already open");
            return;
        }
        if (!initialized || !Yodo1MasRewardAd.getInstance().isLoaded()) {
            call.reject("Rewarded ad is not ready");
            loadRewarded();
            return;
        }
        pendingCall = call;
        rewardEarned = false;
        getActivity().runOnUiThread(
            () -> Yodo1MasRewardAd.getInstance().showAd(getActivity(), PLACEMENT)
        );
    }

    private void finishInitialization() {
        if (initialized) return;
        initialized = true;
        notifyState();
        loadRewarded();
    }

    private void loadRewarded() {
        if (!initialized || loading || Yodo1MasRewardAd.getInstance().isLoaded()) return;
        loading = true;
        notifyState();
        getActivity().runOnUiThread(() -> Yodo1MasRewardAd.getInstance().loadAd(getActivity()));
    }

    private JSObject status() {
        JSObject value = new JSObject();
        value.put("initialized", initialized);
        value.put("loaded", initialized && Yodo1MasRewardAd.getInstance().isLoaded());
        value.put("loading", loading);
        return value;
    }

    private void notifyState() {
        notifyListeners("stateChanged", status(), true);
    }

    private void rejectPending(String message) {
        if (pendingCall == null) return;
        pendingCall.reject(message == null ? "Rewarded ad failed to open" : message);
        pendingCall = null;
    }

    @Override
    public void onRewardAdLoaded(Yodo1MasRewardAd ad) {
        loading = false;
        notifyState();
    }

    @Override
    public void onRewardAdFailedToLoad(Yodo1MasRewardAd ad, @NonNull Yodo1MasError error) {
        loading = false;
        notifyState();
    }

    @Override
    public void onRewardAdOpened(Yodo1MasRewardAd ad) {
        notifyState();
    }

    @Override
    public void onRewardAdFailedToOpen(Yodo1MasRewardAd ad, @NonNull Yodo1MasError error) {
        rejectPending(error.getMessage());
        loadRewarded();
    }

    @Override
    public void onRewardAdClosed(Yodo1MasRewardAd ad) {
        if (pendingCall != null) {
            JSObject result = new JSObject();
            result.put("rewarded", rewardEarned);
            pendingCall.resolve(result);
            pendingCall = null;
        }
        loadRewarded();
    }

    @Override
    public void onRewardAdEarned(Yodo1MasRewardAd ad) {
        rewardEarned = true;
    }
}
