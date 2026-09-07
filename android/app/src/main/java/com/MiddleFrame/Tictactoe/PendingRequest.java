package com.MiddleFrame.Tictactoe;

final class PendingRequest<T> {
    private T value;

    synchronized boolean start(T request) {
        if (value != null) return false;
        value = request;
        return true;
    }

    synchronized T take(T expected) {
        if (value != expected) return null;
        return take();
    }

    synchronized T take() {
        T request = value;
        value = null;
        return request;
    }

    synchronized boolean isPending() {
        return value != null;
    }
}
