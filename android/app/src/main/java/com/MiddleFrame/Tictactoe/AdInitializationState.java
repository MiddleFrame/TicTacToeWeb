package com.MiddleFrame.Tictactoe;

final class AdInitializationState {
    private enum Phase { IDLE, INITIALIZING, READY, DESTROYED }

    private Phase phase = Phase.IDLE;
    private long generation;
    private long retryAt;
    private long retryDelay = 5_000;

    synchronized long begin(long now) {
        if (phase != Phase.IDLE || now < retryAt) return 0;
        phase = Phase.INITIALIZING;
        return ++generation;
    }

    synchronized boolean succeed(long attempt) {
        if (phase != Phase.INITIALIZING || attempt != generation) return false;
        phase = Phase.READY;
        retryDelay = 5_000;
        return true;
    }

    synchronized boolean fail(long attempt, long now) {
        if (phase != Phase.INITIALIZING || attempt != generation) return false;
        phase = Phase.IDLE;
        retryAt = now + retryDelay;
        retryDelay = Math.min(60_000, retryDelay * 2);
        return true;
    }

    synchronized long remainingDelay(long now) {
        return Math.max(0, retryAt - now);
    }

    synchronized boolean isInitialized() {
        return phase == Phase.READY;
    }

    synchronized boolean isInitializing() {
        return phase == Phase.INITIALIZING;
    }

    synchronized boolean isDestroyed() {
        return phase == Phase.DESTROYED;
    }

    synchronized void destroy() {
        phase = Phase.DESTROYED;
    }
}
