package com.MiddleFrame.Tictactoe;

import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.splashscreen.SplashScreen;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class MainActivity extends AppCompatActivity {
    private GameChoiceView choice;
    private FirstLaunchChoice selection;
    private ExecutorService persistence;
    private boolean resumed;
    private boolean readyToOpen;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        SplashScreen.installSplashScreen(this);
        super.onCreate(savedInstanceState);
        GameWorldPreferences preferences = new GameWorldPreferences(this);
        if (preferences.read() != null) {
            readyToOpen = true;
            return;
        }
        WindowCompat.enableEdgeToEdge(getWindow());
        WindowInsetsControllerCompat bars = new WindowInsetsControllerCompat(getWindow(), getWindow().getDecorView());
        bars.setAppearanceLightStatusBars(true);
        bars.setAppearanceLightNavigationBars(true);
        persistence = Executors.newSingleThreadExecutor();
        Handler ui = new Handler(Looper.getMainLooper());
        boolean russian = getResources().getConfiguration().getLocales().get(0).getLanguage().equals("ru");
        selection = new FirstLaunchChoice(preferences, persistence, ui::post, new FirstLaunchChoice.Listener() {
            @Override
            public void saved(String world) {
                if (isFinishing() || isDestroyed()) return;
                releaseChoice();
                setContentView(new View(MainActivity.this));
                readyToOpen = true;
                openGame();
            }

            @Override
            public void failed() {
                if (!isFinishing() && !isDestroyed() && choice != null) choice.failed();
            }
        });
        choice = new GameChoiceView(this, russian, world -> {
            if (selection != null && choice != null && selection.select(world)) choice.saving();
        });
        ViewCompat.setOnApplyWindowInsetsListener(choice, (view, insets) -> {
            androidx.core.graphics.Insets safe = insets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
            int gap = Math.round(20 * getResources().getDisplayMetrics().density);
            view.setPadding(safe.left + gap, safe.top + gap, safe.right + gap, safe.bottom + gap);
            return insets;
        });
        setContentView(choice);
    }

    private void openGame() {
        if (!resumed || !readyToOpen || isFinishing() || isDestroyed()) return;
        readyToOpen = false;
        startActivity(new Intent(this, GameActivity.class));
        finish();
    }

    @Override
    protected void onResume() {
        super.onResume();
        resumed = true;
        if (readyToOpen) openGame();
        if (choice != null) choice.resumeMotion();
    }

    @Override
    protected void onPause() {
        resumed = false;
        if (choice != null) choice.pauseMotion();
        super.onPause();
    }

    private void releaseChoice() {
        if (choice != null) {
            choice.pauseMotion();
            ViewCompat.setOnApplyWindowInsetsListener(choice, null);
            choice = null;
        }
        if (selection != null) selection.close();
    }

    @Override
    protected void onDestroy() {
        releaseChoice();
        if (persistence != null) persistence.shutdown();
        selection = null;
        super.onDestroy();
    }
}
