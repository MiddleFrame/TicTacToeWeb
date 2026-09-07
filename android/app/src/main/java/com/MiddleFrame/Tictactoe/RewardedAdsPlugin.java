package com.MiddleFrame.Tictactoe;

import android.content.SharedPreferences;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import androidx.annotation.NonNull;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.yodo1.mas.Yodo1Mas;
import com.yodo1.mas.error.Yodo1MasError;
import com.yodo1.mas.helper.model.Yodo1MasAdBuildConfig;
import com.yodo1.mas.reward.Yodo1MasRewardAd;
import com.yodo1.mas.reward.Yodo1MasRewardAdListener;
import java.util.HashSet;
import java.util.Set;

@CapacitorPlugin(name = "RewardedAds")
public class RewardedAdsPlugin extends Plugin implements Yodo1MasRewardAdListener {
    private static final String PLACEMENT = "store_reward_50";
    private static final String PREFERENCES = "tttp_rewarded_ads";
    private static final String PRIVACY_CONFIGURED = "privacy_configured";
    private static final String PRIVACY_AGE = "privacy_age";
    private static final String PERSONALIZED_ADS = "personalized_ads";
    private final AdInitializationState initialization = new AdInitializationState();
    private final PendingRequest<PluginCall> pending = new PendingRequest<>();
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private final RewardedAdCallbacks callbacks = new RewardedAdCallbacks(this);
    private final Runnable retryInitialization = this::initializeSavedPrivacy;
    private final Set<PluginCall> queuedCalls = new HashSet<>();
    private boolean loading;
    private boolean showing;
    private boolean appActive = true;
    private boolean privacyConfigured;

    @Override
    public void load() {
        dispatchSdkCallback(() -> {
            Yodo1MasRewardAd rewardAd = Yodo1MasRewardAd.getInstance();
            rewardAd.setAdListener(callbacks);
            rewardAd.autoDelayIfLoadFail = true;
            privacyConfigured = preferences().getBoolean(PRIVACY_CONFIGURED, false);
            initializeSavedPrivacy();
            notifyState();
        });
    }

    @PluginMethod
    public void configurePrivacy(PluginCall call) {
        Integer age = call.getInt("age");
        Boolean personalizedAds = call.getBoolean("personalizedAds");
        if (age == null || age < 1 || age > 100 || personalizedAds == null) {
            call.reject("Invalid ad privacy settings");
            return;
        }
        dispatchCall(call, () -> {
            boolean effectivePersonalization = age >= 16 && personalizedAds;
            preferences().edit()
                .putBoolean(PRIVACY_CONFIGURED, true)
                .putInt(PRIVACY_AGE, age)
                .putBoolean(PERSONALIZED_ADS, effectivePersonalization)
                .apply();
            privacyConfigured = true;
            initializeMas(age, effectivePersonalization);
            call.resolve(status());
        });
    }

    private void initializeSavedPrivacy() {
        if (!privacyConfigured || !appActive || initialization.isDestroyed() || initialization.isInitialized() || initialization.isInitializing()) return;
        long delay = initialization.remainingDelay(SystemClock.uptimeMillis());
        if (delay > 0) {
            mainHandler.removeCallbacks(retryInitialization);
            mainHandler.postDelayed(retryInitialization, delay);
            return;
        }
        SharedPreferences preferences = preferences();
        initializeMas(preferences.getInt(PRIVACY_AGE, 18), preferences.getBoolean(PERSONALIZED_ADS, false));
    }

    private void initializeMas(int age, boolean personalizedAds) {
        if (!appActive) return;
        long attempt = initialization.begin(SystemClock.uptimeMillis());
        if (attempt == 0) return;
        mainHandler.removeCallbacks(retryInitialization);
        try {
            Yodo1MasAdBuildConfig config = new Yodo1MasAdBuildConfig.Builder()
                .enableUserPrivacyDialog(false)
                .build();
            Yodo1Mas.getInstance().setAdBuildConfig(config);
            Yodo1Mas.getInstance().setCOPPA(age < 13);
            Yodo1Mas.getInstance().setGDPR(age >= 16 && personalizedAds);
            Yodo1Mas.getInstance().setCCPA(!personalizedAds);
            notifyState();
            Yodo1Mas.getInstance().initMas(
                getActivity(),
                getActivity().getString(R.string.yodo_mas_app_key),
                RewardedAdCallbacks.initialization(this, attempt)
            );
        } catch (RuntimeException error) {
            failInitialization(attempt);
        }
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        dispatchCall(call, () -> {
            initializeSavedPrivacy();
            loadRewarded();
            call.resolve(status());
        });
    }

    @PluginMethod
    public void showRewarded(PluginCall call) {
        dispatchCall(call, () -> showReadyRewarded(call));
    }

    private void showReadyRewarded(PluginCall call) {
        if (pending.isPending() || showing) {
            call.reject("Rewarded ad is already open");
            return;
        }
        if (!initialization.isInitialized() || !Yodo1MasRewardAd.getInstance().isLoaded()) {
            call.reject("Rewarded ad is not ready");
            initializeSavedPrivacy();
            loadRewarded();
            return;
        }
        pending.start(call);
        showing = true;
        notifyState();
        try {
            Yodo1MasRewardAd.getInstance().showAd(getActivity(), PLACEMENT);
        } catch (RuntimeException error) {
            showing = false;
            rejectPending("Rewarded ad failed to open");
            loadRewarded();
        }
    }

    void finishInitialization(long attempt) {
        if (!initialization.succeed(attempt)) return;
        mainHandler.removeCallbacks(retryInitialization);
        notifyState();
        loadRewarded();
    }

    void failInitialization(long attempt) {
        if (!initialization.fail(attempt, SystemClock.uptimeMillis())) return;
        notifyState();
        mainHandler.removeCallbacks(retryInitialization);
        if (appActive) mainHandler.postDelayed(retryInitialization, initialization.remainingDelay(SystemClock.uptimeMillis()));
    }

    private void loadRewarded() {
        if (!appActive || !initialization.isInitialized() || loading || showing || Yodo1MasRewardAd.getInstance().isLoaded()) return;
        loading = true;
        notifyState();
        try {
            Yodo1MasRewardAd.getInstance().loadAd(getActivity());
        } catch (RuntimeException error) {
            loading = false;
            notifyState();
        }
    }

    private JSObject status() {
        JSObject value = new JSObject();
        value.put("privacyConfigured", privacyConfigured);
        value.put("initialized", initialization.isInitialized());
        value.put("loaded", initialization.isInitialized() && !showing && Yodo1MasRewardAd.getInstance().isLoaded());
        value.put("loading", initialization.isInitializing() || loading);
        return value;
    }

    private SharedPreferences preferences() {
        return getContext().getSharedPreferences(PREFERENCES, 0);
    }

    private void notifyState() {
        notifyListeners("stateChanged", status(), true);
    }

    private void rejectPending(String message) {
        PluginCall call = pending.take();
        if (call != null) call.reject(message == null ? "Rewarded ad failed to open" : message);
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
        showing = false;
        rejectPending(error.getMessage());
        loadRewarded();
    }

    @Override
    public void onRewardAdClosed(Yodo1MasRewardAd ad) {
        showing = false;
        PluginCall call = pending.take();
        if (call != null) {
            JSObject result = new JSObject();
            result.put("rewarded", false);
            call.resolve(result);
        }
        loadRewarded();
    }

    @Override
    public void onRewardAdEarned(Yodo1MasRewardAd ad) {
        PluginCall call = pending.take();
        if (call == null) return;
        JSObject result = new JSObject();
        result.put("rewarded", true);
        call.resolve(result);
    }

    void dispatchSdkCallback(Runnable action) {
        if (initialization.isDestroyed()) return;
        Runnable guarded = () -> {
            if (!initialization.isDestroyed()) action.run();
        };
        if (Looper.myLooper() == Looper.getMainLooper()) guarded.run();
        else mainHandler.post(guarded);
    }

    private synchronized void dispatchCall(PluginCall call, Runnable action) {
        if (initialization.isDestroyed()) {
            call.reject("Rewarded ads are unavailable");
            return;
        }
        queuedCalls.add(call);
        mainHandler.post(() -> {
            synchronized (this) {
                if (queuedCalls.remove(call)) action.run();
            }
        });
    }

    @Override
    protected void handleOnResume() {
        super.handleOnResume();
        dispatchSdkCallback(() -> {
            appActive = true;
            initializeSavedPrivacy();
            loadRewarded();
        });
    }

    @Override
    protected void handleOnPause() {
        dispatchSdkCallback(() -> {
            appActive = false;
            mainHandler.removeCallbacks(retryInitialization);
        });
        super.handleOnPause();
    }

    @Override
    protected synchronized void handleOnDestroy() {
        initialization.destroy();
        callbacks.clear();
        mainHandler.removeCallbacksAndMessages(null);
        for (PluginCall call : queuedCalls) call.reject("Rewarded ads are unavailable");
        queuedCalls.clear();
        rejectPending("Rewarded ads are unavailable");
        super.handleOnDestroy();
    }
}
