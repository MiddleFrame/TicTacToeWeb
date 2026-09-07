package com.MiddleFrame.Tictactoe;

import androidx.annotation.NonNull;
import com.yodo1.mas.Yodo1Mas;
import com.yodo1.mas.Yodo1MasSdkConfiguration;
import com.yodo1.mas.error.Yodo1MasError;
import com.yodo1.mas.reward.Yodo1MasRewardAd;
import com.yodo1.mas.reward.Yodo1MasRewardAdListener;
import java.lang.ref.WeakReference;
import java.util.function.Consumer;

final class RewardedAdCallbacks implements Yodo1MasRewardAdListener {
    private final WeakReference<RewardedAdsPlugin> owner;

    RewardedAdCallbacks(RewardedAdsPlugin plugin) {
        owner = new WeakReference<>(plugin);
    }

    void clear() {
        owner.clear();
    }

    private void dispatch(Consumer<RewardedAdsPlugin> action) {
        RewardedAdsPlugin plugin = owner.get();
        if (plugin != null) plugin.dispatchSdkCallback(() -> action.accept(plugin));
    }

    public void onRewardAdLoaded(Yodo1MasRewardAd ad) {
        dispatch(plugin -> plugin.onRewardAdLoaded(ad));
    }

    public void onRewardAdFailedToLoad(Yodo1MasRewardAd ad, @NonNull Yodo1MasError error) {
        dispatch(plugin -> plugin.onRewardAdFailedToLoad(ad, error));
    }

    public void onRewardAdOpened(Yodo1MasRewardAd ad) {
        dispatch(plugin -> plugin.onRewardAdOpened(ad));
    }

    public void onRewardAdFailedToOpen(Yodo1MasRewardAd ad, @NonNull Yodo1MasError error) {
        dispatch(plugin -> plugin.onRewardAdFailedToOpen(ad, error));
    }

    public void onRewardAdClosed(Yodo1MasRewardAd ad) {
        dispatch(plugin -> plugin.onRewardAdClosed(ad));
    }

    public void onRewardAdEarned(Yodo1MasRewardAd ad) {
        dispatch(plugin -> plugin.onRewardAdEarned(ad));
    }

    static Yodo1Mas.InitListener initialization(RewardedAdsPlugin plugin, long attempt) {
        WeakReference<RewardedAdsPlugin> owner = new WeakReference<>(plugin);
        return new Yodo1Mas.InitListener() {
            private void dispatch(Consumer<RewardedAdsPlugin> action) {
                RewardedAdsPlugin target = owner.get();
                if (target != null) target.dispatchSdkCallback(() -> action.accept(target));
            }

            public void onMasInitSuccessful() {
                dispatch(target -> target.finishInitialization(attempt));
            }

            public void onMasInitSuccessful(Yodo1MasSdkConfiguration configuration) {
                onMasInitSuccessful();
            }

            public void onMasInitFailed(@NonNull Yodo1MasError error) {
                dispatch(target -> target.failInitialization(attempt));
            }
        };
    }
}
