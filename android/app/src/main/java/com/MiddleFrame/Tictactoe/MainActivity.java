package com.MiddleFrame.Tictactoe;

import android.os.Bundle;
import android.os.SystemClock;
import androidx.core.splashscreen.SplashScreen;
import androidx.core.view.WindowCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final long SPLASH_DURATION_MS = 2000;
    private static final String PAUSE_EVENT = "tttp-app-pause";
    private static final String RESUME_EVENT = "tttp-app-resume";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        long splashStartedAt = SystemClock.uptimeMillis();
        SplashScreen splashScreen = SplashScreen.installSplashScreen(this);
        splashScreen.setKeepOnScreenCondition(
            () -> SystemClock.uptimeMillis() - splashStartedAt < SPLASH_DURATION_MS
        );
        super.onCreate(savedInstanceState);
        WindowCompat.enableEdgeToEdge(getWindow());
    }

    @Override
    public void onPause() {
        dispatchAppEvent(PAUSE_EVENT);
        super.onPause();
    }

    @Override
    public void onResume() {
        super.onResume();
        dispatchAppEvent(RESUME_EVENT);
    }

    private void dispatchAppEvent(String eventName) {
        if (getBridge() == null || getBridge().getWebView() == null) return;
        getBridge().getWebView().evaluateJavascript(
            "window.dispatchEvent(new Event('" + eventName + "'))",
            null
        );
    }
}
