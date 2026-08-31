package com.MiddleFrame.Tictactoe;

import android.content.SharedPreferences;
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
    private static final String PREFERENCES = "tttp_rewarded_ads";
    private static final String PRIVACY_CONFIGURED = "privacy_configured";
    private static final String PRIVACY_AGE = "privacy_age";
    private static final String PERSONALIZED_ADS = "personalized_ads";
    private boolean initialized;
    private boolean initializing;
    private boolean loading;
    private boolean privacyConfigured;
    private PluginCall pendingCall;

    @Override
    public void load() {
        Yodo1MasRewardAd rewardAd = Yodo1MasRewardAd.getInstance();
        rewardAd.setAdListener(this);
        rewardAd.autoDelayIfLoadFail = true;
        SharedPreferences preferences = preferences();
        privacyConfigured = preferences.getBoolean(PRIVACY_CONFIGURED, false);
        if (privacyConfigured) {
            initializeMas(
                preferences.getInt(PRIVACY_AGE, 18),
                preferences.getBoolean(PERSONALIZED_ADS, false)
            );
        } else {
            notifyState();
        }
    }

    @PluginMethod
    public void configurePrivacy(PluginCall call) {
        Integer age = call.getInt("age");
        Boolean personalizedAds = call.getBoolean("personalizedAds");
        if (age == null || age < 1 || age > 100 || personalizedAds == null) {
            call.reject("Invalid ad privacy settings");
            return;
        }
        boolean effectivePersonalization = age >= 16 && personalizedAds;
        preferences().edit()
            .putBoolean(PRIVACY_CONFIGURED, true)
            .putInt(PRIVACY_AGE, age)
            .putBoolean(PERSONALIZED_ADS, effectivePersonalization)
            .apply();
        privacyConfigured = true;
        initializeMas(age, effectivePersonalization);
        call.resolve(status());
    }

    private void initializeMas(int age, boolean personalizedAds) {
        if (initialized || initializing) return;
        initializing = true;
        Yodo1MasAdBuildConfig config = new Yodo1MasAdBuildConfig.Builder()
            .enableUserPrivacyDialog(false)
            .build();
        Yodo1Mas.getInstance().setAdBuildConfig(config);
        Yodo1Mas.getInstance().setCOPPA(age < 13);
        Yodo1Mas.getInstance().setGDPR(age >= 16 && personalizedAds);
        Yodo1Mas.getInstance().setCCPA(!personalizedAds);
        notifyState();
        getActivity().runOnUiThread(() ->
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
                        initializing = false;
                        notifyState();
                    }
                }
            )
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
        getActivity().runOnUiThread(
            () -> Yodo1MasRewardAd.getInstance().showAd(getActivity(), PLACEMENT)
        );
    }

    private void finishInitialization() {
        if (initialized) return;
        initializing = false;
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
        value.put("privacyConfigured", privacyConfigured);
        value.put("initialized", initialized);
        value.put("loaded", initialized && Yodo1MasRewardAd.getInstance().isLoaded());
        value.put("loading", initializing || loading);
        return value;
    }

    private SharedPreferences preferences() {
        return getContext().getSharedPreferences(PREFERENCES, 0);
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
            result.put("rewarded", false);
            pendingCall.resolve(result);
            pendingCall = null;
        }
        loadRewarded();
    }

    @Override
    public void onRewardAdEarned(Yodo1MasRewardAd ad) {
        if (pendingCall == null) return;
        JSObject result = new JSObject();
        result.put("rewarded", true);
        pendingCall.resolve(result);
        pendingCall = null;
    }
}
