package com.MiddleFrame.Tictactoe;

import android.content.Context;
import android.annotation.SuppressLint;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.RectF;
import android.graphics.Typeface;
import android.view.View;
import android.view.accessibility.AccessibilityNodeInfo;
import java.util.Locale;

@SuppressLint("ViewConstructor")
final class WorldCardView extends View {
    private static final int INK = Color.rgb(22, 22, 22);
    private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final RectF box = new RectF();
    private final Path path = new Path();
    private final float density;
    private final String world;
    private final String subtitle;
    private float tiltX;
    private float tiltY;

    WorldCardView(Context context, String world, boolean russian) {
        super(context);
        density = getResources().getDisplayMetrics().density;
        this.world = world;
        subtitle = world.equals("tttp") ? "Tic Tac Toe Plus" : "Tic Tac Toe Roguelite";
        setClickable(true);
        setFocusable(true);
        setImportantForAccessibility(IMPORTANT_FOR_ACCESSIBILITY_YES);
        setCameraDistance(8000 * density);
        setContentDescription(world.toUpperCase(Locale.ROOT) + ". " + subtitle + ". " +
            (world.equals("tttp") ? (russian ? "Коллекционная карточная игра" : "Collectible card game") : (russian ? "Роглайт" : "Roguelite")));
    }

    void tilt(float x, float y) {
        tiltX = x;
        tiltY = y;
        setRotationX(x);
        setRotationY(y);
        invalidate();
    }

    @Override
    protected void onDraw(Canvas canvas) {
        super.onDraw(canvas);
        canvas.save();
        canvas.scale(density, density);
        float width = getWidth() / density;
        float height = getHeight() / density;
        paint.setStyle(Paint.Style.FILL);
        paint.setColor(INK);
        box.set(9, 10, width - 3, height - 2);
        canvas.drawRoundRect(box, 16, 16, paint);
        box.set(3, 3, width - 9, height - 10);
        paint.setColor(isPressed() ? Color.rgb(242, 242, 239) : Color.WHITE);
        canvas.drawRoundRect(box, 16, 16, paint);
        paint.setColor(INK);
        paint.setStyle(Paint.Style.STROKE);
        paint.setStrokeWidth(isFocused() ? 3 : 2);
        canvas.drawRoundRect(box, 16, 16, paint);
        boolean compact = height < 172;
        float artSize = compact ? Math.min(80, height - 25) : Math.min(116, height - 96);
        canvas.save();
        canvas.translate((compact ? width * .78f : width / 2) + tiltY * 1.3f,
            (compact ? height * .46f : 16 + artSize / 2) - tiltX);
        canvas.scale(artSize / 110, artSize / 110);
        if (world.equals("tttp")) drawDeck(canvas);
        else drawRun(canvas);
        canvas.restore();
        paint.setColor(INK);
        paint.setStyle(Paint.Style.FILL);
        paint.setTypeface(Typeface.create("sans-serif", Typeface.BOLD));
        float labelY = compact ? Math.max(24, height * .4f) : height - 49;
        paint.setTextSize(Math.min(30, height * .2f));
        canvas.drawText(world.toUpperCase(Locale.ROOT), 21, labelY, paint);
        paint.setTypeface(Typeface.create("sans-serif", Typeface.NORMAL));
        paint.setTextSize(12);
        float available = compact ? width * .6f - 30 : width - 44;
        if (paint.measureText(subtitle) > available) paint.setTextSize(12 * available / paint.measureText(subtitle));
        canvas.drawText(subtitle, 22, labelY + 20, paint);
        paint.setTypeface(Typeface.create("sans-serif", Typeface.BOLD));
        paint.setTextSize(9);
        paint.setTextAlign(compact ? Paint.Align.LEFT : Paint.Align.RIGHT);
        canvas.drawText(world.equals("tttp") ? "CCG" : "ROGUELITE", compact ? 22 : width - 27, compact ? labelY + 38 : height - 51, paint);
        paint.setTextAlign(Paint.Align.LEFT);
        canvas.restore();
    }

    private void drawDeck(Canvas canvas) {
        drawCard(canvas, -31, 4, -18, false);
        drawCard(canvas, 30, 0, 17, true);
        drawCard(canvas, tiltY * .8f, -6 - tiltX, -3, false);
        paint.setStyle(Paint.Style.STROKE);
        paint.setStrokeWidth(1);
        canvas.drawLine(-57, 43, -45, 43, paint);
        canvas.drawLine(45, -38, 58, -38, paint);
        canvas.drawCircle(55, 32, 4, paint);
    }

    private void drawCard(Canvas canvas, float x, float y, float angle, boolean circle) {
        canvas.save();
        canvas.translate(x, y);
        canvas.rotate(angle);
        paint.setStyle(Paint.Style.FILL);
        paint.setColor(INK);
        box.set(-23, -29, 28, 37);
        canvas.drawRoundRect(box, 4, 4, paint);
        paint.setColor(Color.WHITE);
        box.set(-27, -34, 24, 32);
        canvas.drawRoundRect(box, 4, 4, paint);
        paint.setColor(INK);
        paint.setStyle(Paint.Style.STROKE);
        paint.setStrokeWidth(2);
        canvas.drawRoundRect(box, 4, 4, paint);
        figure(canvas, -2, -4, 12, circle);
        paint.setStrokeWidth(1);
        canvas.drawLine(-17, 20, 13, 20, paint);
        canvas.drawLine(-12, 24, 8, 24, paint);
        canvas.restore();
    }

    private void drawRun(Canvas canvas) {
        paint.setStyle(Paint.Style.STROKE);
        paint.setStrokeWidth(2);
        box.set(-23, -44, 23, 12);
        canvas.drawRoundRect(box, 23, 23, paint);
        box.set(-17, -37, 17, 14);
        canvas.drawRoundRect(box, 17, 17, paint);
        for (int step = 0; step < 3; step++) {
            float y = step * 16;
            float half = 23 + step * 10;
            paint.setStyle(Paint.Style.FILL);
            paint.setColor(INK);
            diamond(canvas, half, y + 7, 13);
            paint.setColor(Color.WHITE);
            diamond(canvas, half, y, 13);
            paint.setColor(INK);
            paint.setStyle(Paint.Style.STROKE);
            paint.setStrokeWidth(2);
            diamond(canvas, half, y, 13);
        }
        figure(canvas, -40 + tiltY, -24 - tiltX, 8, false);
        figure(canvas, 41 + tiltY * 1.6f, -3 - tiltX * 1.5f, 7, true);
        paint.setStrokeWidth(1);
        canvas.drawLine(-51, 8, -46, 3, paint);
        canvas.drawLine(38, -32, 43, -37, paint);
    }

    private void diamond(Canvas canvas, float half, float y, float depth) {
        path.reset();
        path.moveTo(-half, y);
        path.lineTo(0, y - depth);
        path.lineTo(half, y);
        path.lineTo(0, y + depth);
        path.close();
        canvas.drawPath(path, paint);
    }

    private void figure(Canvas canvas, float x, float y, float size, boolean circle) {
        paint.setStrokeWidth(4);
        paint.setStrokeCap(Paint.Cap.ROUND);
        if (circle) canvas.drawCircle(x, y, size, paint);
        else {
            canvas.drawLine(x - size, y - size, x + size, y + size, paint);
            canvas.drawLine(x + size, y - size, x - size, y + size, paint);
        }
        paint.setStrokeCap(Paint.Cap.BUTT);
    }

    @Override
    protected void drawableStateChanged() {
        super.drawableStateChanged();
        invalidate();
    }

    @Override
    public void onInitializeAccessibilityNodeInfo(AccessibilityNodeInfo info) {
        super.onInitializeAccessibilityNodeInfo(info);
        info.setClassName("android.widget.Button");
    }
}
