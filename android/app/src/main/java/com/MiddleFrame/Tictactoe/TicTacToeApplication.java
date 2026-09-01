package com.MiddleFrame.Tictactoe;

import android.app.Application;
import com.google.android.gms.games.PlayGamesSdk;

public class TicTacToeApplication extends Application {
    @Override
    public void onCreate() {
        super.onCreate();
        PlayGamesSdk.initialize(this);
    }
}
