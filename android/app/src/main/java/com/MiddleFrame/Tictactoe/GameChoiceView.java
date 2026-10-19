package com.MiddleFrame.Tictactoe;

import android.content.Context;
import android.annotation.SuppressLint;
import android.graphics.Color;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.provider.Settings;
import android.view.Gravity;
import android.view.View;
import android.widget.LinearLayout;
import android.widget.TextView;
import java.util.function.Consumer;

@SuppressLint("ViewConstructor")
final class GameChoiceView extends LinearLayout implements SensorEventListener {
    private final WorldCardView plus;
    private final WorldCardView roguelite;
    private final TextView note;
    private final SensorManager sensors;
    private final ChoiceTilt tilt = new ChoiceTilt();
    private final float[] matrix = new float[9];
    private final float[] angles = new float[3];
    private final boolean russian;
    private boolean resumed;
    private boolean listening;
    private boolean framePosted;
    private boolean entered;
    private float currentX;
    private float currentY;
    private final Runnable frame = this::animateTilt;

    GameChoiceView(Context context, boolean russian, Consumer<String> select) {
        super(context);
        this.russian = russian;
        setOrientation(VERTICAL);
        setGravity(Gravity.CENTER_HORIZONTAL);
        setBackgroundColor(Color.rgb(250, 250, 248));
        sensors = (SensorManager) context.getSystemService(Context.SENSOR_SERVICE);
        TextView title = text(russian ? "Выберите свою игру" : "Choose your game", 28);
        title.setTypeface(null, android.graphics.Typeface.BOLD);
        title.setMaxLines(1);
        title.setEllipsize(android.text.TextUtils.TruncateAt.END);
        title.setPadding(0, dp(8), 0, dp(6));
        addView(title, new LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT));
        TextView subtitle = text(russian ? "Колоды или забеги — решать вам." : "Build a deck. Or start a run.", 14);
        subtitle.setTextColor(Color.rgb(102, 102, 102));
        subtitle.setMaxLines(2);
        subtitle.setEllipsize(android.text.TextUtils.TruncateAt.END);
        subtitle.setPadding(0, 0, 0, dp(18));
        addView(subtitle, new LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT));
        plus = card("tttp", select);
        roguelite = card("tttr", select);
        note = text(defaultNote(), 12);
        note.setTextColor(Color.rgb(102, 102, 102));
        note.setMaxLines(2);
        note.setPadding(0, dp(12), 0, dp(4));
        note.setAccessibilityLiveRegion(ACCESSIBILITY_LIVE_REGION_POLITE);
        addView(note, new LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT));
    }

    private TextView text(String value, int size) {
        TextView view = new TextView(getContext());
        view.setText(value);
        view.setTextSize(size);
        view.setTextColor(Color.rgb(22, 22, 22));
        view.setGravity(Gravity.CENTER);
        return view;
    }

    private WorldCardView card(String world, Consumer<String> select) {
        WorldCardView view = new WorldCardView(getContext(), world, russian);
        LayoutParams layout = new LayoutParams(LayoutParams.MATCH_PARENT, 0, 1);
        layout.bottomMargin = dp(10);
        addView(view, layout);
        view.setOnClickListener(ignored -> select.accept(world));
        return view;
    }

    private String defaultNote() {
        return russian ? "Запомним ваш выбор.\nСменить игру можно в меню." : "We'll remember your choice.\nYou can switch games in the menu.";
    }

    void saving() {
        plus.setEnabled(false);
        roguelite.setEnabled(false);
        note.setText(russian ? "Сохраняем выбор…" : "Saving your choice…");
    }

    void failed() {
        plus.setEnabled(true);
        roguelite.setEnabled(true);
        note.setText(russian ? "Не удалось сохранить выбор.\nНажмите на карточку ещё раз." : "Could not save your choice.\nTap a card to try again.");
    }

    void resumeMotion() {
        resumed = true;
        startMotion();
    }

    void pauseMotion() {
        resumed = false;
        if (sensors != null && listening) sensors.unregisterListener(this);
        listening = false;
        removeCallbacks(frame);
        framePosted = false;
        tilt.reset();
        currentX = currentY = 0;
        plus.tilt(0, 0);
        roguelite.tilt(0, 0);
        plus.animate().cancel();
        roguelite.animate().cancel();
        plus.setAlpha(1);
        roguelite.setAlpha(1);
        plus.setTranslationY(0);
        roguelite.setTranslationY(0);
    }

    private boolean motionAllowed() {
        return Settings.Global.getFloat(getContext().getContentResolver(), Settings.Global.ANIMATOR_DURATION_SCALE, 1) != 0;
    }

    private void startMotion() {
        if (!resumed || !isAttachedToWindow() || listening || sensors == null || !motionAllowed()) return;
        Sensor sensor = sensors.getDefaultSensor(Sensor.TYPE_GAME_ROTATION_VECTOR);
        if (sensor == null) sensor = sensors.getDefaultSensor(Sensor.TYPE_ROTATION_VECTOR);
        if (sensor != null) listening = sensors.registerListener(this, sensor, SensorManager.SENSOR_DELAY_UI);
    }

    @Override
    protected void onAttachedToWindow() {
        super.onAttachedToWindow();
        if (!entered) {
            entered = true;
            if (motionAllowed()) {
                for (WorldCardView view : new WorldCardView[] {plus, roguelite}) {
                    view.setAlpha(0);
                    view.setTranslationY(dp(18));
                    view.animate().alpha(1).translationY(0).setStartDelay(view == plus ? 40 : 110).setDuration(420).start();
                }
            }
        }
        startMotion();
    }

    @Override
    protected void onDetachedFromWindow() {
        pauseMotion();
        plus.setOnClickListener(null);
        roguelite.setOnClickListener(null);
        super.onDetachedFromWindow();
    }

    @Override
    public void onSensorChanged(SensorEvent event) {
        if (!resumed || !listening) return;
        SensorManager.getRotationMatrixFromVector(matrix, event.values);
        SensorManager.getOrientation(matrix, angles);
        if (tilt.update(angles[1], angles[2]) && !framePosted) {
            framePosted = true;
            postOnAnimation(frame);
        }
    }

    private void animateTilt() {
        framePosted = false;
        if (!resumed || !listening) return;
        currentX += (tilt.x() - currentX) * .18f;
        currentY += (tilt.y() - currentY) * .18f;
        plus.tilt(currentX, currentY);
        roguelite.tilt(currentX * -.8f, currentY * .8f);
        if (Math.abs(tilt.x() - currentX) + Math.abs(tilt.y() - currentY) > .02f) {
            framePosted = true;
            postOnAnimation(frame);
        }
    }

    @Override
    public void onAccuracyChanged(Sensor sensor, int accuracy) {}

    private int dp(float value) { return Math.round(value * getResources().getDisplayMetrics().density); }
}
