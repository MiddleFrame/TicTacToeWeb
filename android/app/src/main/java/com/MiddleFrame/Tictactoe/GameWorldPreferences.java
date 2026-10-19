package com.MiddleFrame.Tictactoe;

import android.content.Context;
import android.content.SharedPreferences;

final class GameWorldPreferences implements FirstLaunchChoice.Storage {
    private final SharedPreferences preferences;

    GameWorldPreferences(Context context) {
        preferences = context.getApplicationContext().getSharedPreferences("tttp-world-v1", Context.MODE_PRIVATE);
    }

    @Override
    public String read() {
        Object value = preferences.getAll().get("default-world");
        String world = value instanceof String ? (String) value : null;
        return FirstLaunchChoice.valid(world) ? world : null;
    }

    @Override
    public boolean write(String world) {
        if (!FirstLaunchChoice.valid(world)) return false;
        String previous = read();
        if (preferences.edit().putString("default-world", world).commit()) return true;
        SharedPreferences.Editor restore = preferences.edit();
        if (previous == null) restore.remove("default-world");
        else restore.putString("default-world", previous);
        restore.apply();
        return false;
    }
}
