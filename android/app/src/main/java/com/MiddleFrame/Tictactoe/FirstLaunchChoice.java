package com.MiddleFrame.Tictactoe;

import java.util.concurrent.Executor;

final class FirstLaunchChoice {
    interface Storage {
        String read();
        boolean write(String world);
    }

    interface Listener {
        void saved(String world);
        void failed();
    }

    private final Storage storage;
    private final Executor worker;
    private final Executor ui;
    private Listener listener;
    private boolean saving;

    FirstLaunchChoice(Storage storage, Executor worker, Executor ui, Listener listener) {
        this.storage = storage;
        this.worker = worker;
        this.ui = ui;
        this.listener = listener;
    }

    static boolean valid(String world) {
        return "tttp".equals(world) || "tttr".equals(world);
    }

    synchronized boolean select(String world) {
        if (!valid(world) || saving || listener == null) return false;
        saving = true;
        worker.execute(() -> {
            boolean committed;
            try { committed = storage.write(world); }
            catch (RuntimeException error) { committed = false; }
            boolean result = committed;
            ui.execute(() -> complete(world, result));
        });
        return true;
    }

    private synchronized void complete(String world, boolean committed) {
        if (listener == null) return;
        saving = false;
        if (committed) {
            Listener completed = listener;
            listener = null;
            completed.saved(world);
        } else {
            listener.failed();
        }
    }

    synchronized void close() {
        listener = null;
    }
}
