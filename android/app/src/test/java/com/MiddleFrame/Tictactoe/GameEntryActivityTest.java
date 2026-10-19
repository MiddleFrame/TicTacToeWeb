package com.MiddleFrame.Tictactoe;

import static org.junit.Assert.*;
import static org.robolectric.Shadows.shadowOf;
import android.app.Application;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.hardware.Sensor;
import android.hardware.SensorManager;
import android.os.Looper;
import android.provider.Settings;
import android.view.View;
import android.view.ViewGroup;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import java.io.File;
import java.io.FileOutputStream;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.Robolectric;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.android.controller.ActivityController;
import org.robolectric.annotation.Config;
import org.robolectric.annotation.GraphicsMode;
import org.robolectric.annotation.LooperMode;
import org.robolectric.shadows.ShadowSensor;
import org.robolectric.shadows.ShadowSensorManager;

@RunWith(RobolectricTestRunner.class)
@Config(application = Application.class, sdk = 28, qualifiers = "ru-w360dp-h640dp-port-mdpi")
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@LooperMode(LooperMode.Mode.PAUSED)
public class GameEntryActivityTest {
    @Before
    public void isolatedPreferences() {
        Context context = RuntimeEnvironment.getApplication();
        context.getSharedPreferences("tttp-world-v1", Context.MODE_PRIVATE).edit().clear().commit();
        Settings.Global.putFloat(context.getContentResolver(), Settings.Global.ANIMATOR_DURATION_SCALE, 0);
    }

    @Test
    public void firstChoicePersistsBeforeNavigationAndTheNextLaunchSkipsAllChoiceViews() throws Exception {
        ActivityController<MainActivity> controller = Robolectric.buildActivity(MainActivity.class).setup();
        MainActivity activity = controller.get();
        List<WorldCardView> cards = cards(activity.findViewById(android.R.id.content));
        assertEquals(2, cards.size());
        assertTrue(cards.get(0).getContentDescription().toString().startsWith("TTTP."));
        assertTrue(cards.get(1).getContentDescription().toString().startsWith("TTTR."));
        assertNull(shadowOf(activity).peekNextStartedActivity());
        cards.get(1).performClick();
        cards.get(0).performClick();
        long deadline = System.nanoTime() + 5_000_000_000L;
        while (shadowOf(activity).peekNextStartedActivity() == null && System.nanoTime() < deadline) {
            Thread.sleep(5);
            shadowOf(Looper.getMainLooper()).idle();
        }
        Intent game = shadowOf(activity).getNextStartedActivity();
        assertNotNull(game);
        assertEquals(GameActivity.class.getName(), game.getComponent().getClassName());
        assertEquals("tttr", new GameWorldPreferences(activity).read());
        assertTrue(activity.isFinishing());
        assertTrue(cards(activity.findViewById(android.R.id.content)).isEmpty());
        controller.pause().stop().destroy();
        ActivityController<MainActivity> next = Robolectric.buildActivity(MainActivity.class).create();
        assertTrue(cards(next.get().findViewById(android.R.id.content)).isEmpty());
        assertNull(shadowOf(next.get()).peekNextStartedActivity());
        next.start().resume();
        assertEquals(GameActivity.class.getName(), shadowOf(next.get()).getNextStartedActivity().getComponent().getClassName());
        next.pause().stop().destroy();
    }

    @Test
    public void savingWhilePausedDefersNavigationUntilResume() throws Exception {
        ActivityController<MainActivity> controller = Robolectric.buildActivity(MainActivity.class).setup();
        MainActivity activity = controller.get();
        cards(activity.findViewById(android.R.id.content)).get(1).performClick();
        controller.pause();
        long deadline = System.nanoTime() + 5_000_000_000L;
        while (!cards(activity.findViewById(android.R.id.content)).isEmpty() && System.nanoTime() < deadline) {
            Thread.sleep(5);
            shadowOf(Looper.getMainLooper()).idle();
            assertNull(shadowOf(activity).peekNextStartedActivity());
        }
        assertEquals("tttr", new GameWorldPreferences(activity).read());
        assertNull(shadowOf(activity).peekNextStartedActivity());
        assertTrue(cards(activity.findViewById(android.R.id.content)).isEmpty());
        controller.resume();
        assertEquals(GameActivity.class.getName(), shadowOf(activity).getNextStartedActivity().getComponent().getClassName());
        assertNull(shadowOf(activity).peekNextStartedActivity());
        controller.pause().stop().destroy();
    }

    @Test
    public void realSensorSubscriptionStopsOnPauseAndDestroyAndRecalibratesOnResume() {
        Settings.Global.putFloat(RuntimeEnvironment.getApplication().getContentResolver(), Settings.Global.ANIMATOR_DURATION_SCALE, 1);
        ActivityController<MainActivity> controller = Robolectric.buildActivity(MainActivity.class).create();
        SensorManager manager = (SensorManager) controller.get().getSystemService(Context.SENSOR_SERVICE);
        ShadowSensorManager sensors = shadowOf(manager);
        sensors.addSensor(ShadowSensor.newInstance(Sensor.TYPE_GAME_ROTATION_VECTOR));
        controller.start().resume().visible();
        assertEquals(1, sensors.getListeners().size());
        controller.pause();
        assertTrue(sensors.getListeners().isEmpty());
        shadowOf(Looper.getMainLooper()).idleFor(Duration.ofMillis(500));
        for (WorldCardView card : cards(controller.get().findViewById(android.R.id.content))) {
            assertEquals(0, card.getRotationX(), .001f);
            assertEquals(0, card.getRotationY(), .001f);
            assertEquals(1, card.getAlpha(), .001f);
        }
        controller.resume();
        assertEquals(1, sensors.getListeners().size());
        controller.pause().stop().destroy();
        assertTrue(sensors.getListeners().isEmpty());
    }

    @Test
    public void rendersBothCardsWithinSafeBoundsAndExportsTheActualNativeDrawing() throws Exception {
        ActivityController<MainActivity> controller = Robolectric.buildActivity(MainActivity.class).setup();
        GameChoiceView choice = (GameChoiceView) ((ViewGroup) controller.get().findViewById(android.R.id.content)).getChildAt(0);
        ViewCompat.dispatchApplyWindowInsets(choice, new WindowInsetsCompat.Builder()
            .setInsets(WindowInsetsCompat.Type.systemBars(), Insets.of(0, 24, 0, 48)).build());
        choice.measure(View.MeasureSpec.makeMeasureSpec(360, View.MeasureSpec.EXACTLY), View.MeasureSpec.makeMeasureSpec(640, View.MeasureSpec.EXACTLY));
        choice.layout(0, 0, 360, 640);
        List<WorldCardView> cards = cards(choice);
        assertEquals(2, cards.size());
        for (WorldCardView card : cards) {
            assertTrue(card.getWidth() >= 200);
            assertTrue(card.getHeight() >= 48);
            assertTrue(card.getTop() >= 24);
            assertTrue(card.getBottom() <= 640 - 48);
        }
        Bitmap image = Bitmap.createBitmap(360, 640, Bitmap.Config.ARGB_8888);
        choice.draw(new Canvas(image));
        File folder = new File("build/reports/first-launch");
        assertTrue(folder.isDirectory() || folder.mkdirs());
        try (FileOutputStream output = new FileOutputStream(new File(folder, "android-first-launch.png"))) {
            assertTrue(image.compress(Bitmap.CompressFormat.PNG, 100, output));
        }
        image.recycle();
        controller.pause().stop().destroy();
    }

    private List<WorldCardView> cards(View root) {
        List<WorldCardView> result = new ArrayList<>();
        collect(root, result);
        return result;
    }

    private void collect(View view, List<WorldCardView> result) {
        if (view instanceof WorldCardView) result.add((WorldCardView) view);
        if (view instanceof ViewGroup) {
            ViewGroup group = (ViewGroup) view;
            for (int index = 0; index < group.getChildCount(); index++) collect(group.getChildAt(index), result);
        }
    }
}
