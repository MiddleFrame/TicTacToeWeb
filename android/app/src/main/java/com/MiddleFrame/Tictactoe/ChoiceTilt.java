package com.MiddleFrame.Tictactoe;

final class ChoiceTilt {
    private boolean calibrated;
    private float pitchOrigin;
    private float rollOrigin;
    private float x;
    private float y;

    boolean update(float pitch, float roll) {
        if (!Float.isFinite(pitch) || !Float.isFinite(roll)) return false;
        if (!calibrated) {
            calibrated = true;
            pitchOrigin = pitch;
            rollOrigin = roll;
        }
        x = angle(pitch - pitchOrigin) * -18;
        y = angle(roll - rollOrigin) * 18;
        x = Math.max(-5, Math.min(5, x));
        y = Math.max(-5, Math.min(5, y));
        return true;
    }

    private float angle(float value) {
        return (float) Math.atan2(Math.sin(value), Math.cos(value));
    }

    float x() { return x; }
    float y() { return y; }

    void reset() {
        calibrated = false;
        x = 0;
        y = 0;
    }
}
