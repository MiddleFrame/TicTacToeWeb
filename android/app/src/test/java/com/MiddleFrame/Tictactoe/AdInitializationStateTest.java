package com.MiddleFrame.Tictactoe;

import static org.junit.Assert.*;
import org.junit.Test;

public class AdInitializationStateTest {
    @Test
    public void retriesFailedInitializationWithBoundedBackoff() {
        AdInitializationState state = new AdInitializationState();
        long now = 100;
        long[] delays = {5_000, 10_000, 20_000, 40_000, 60_000, 60_000};
        for (long delay : delays) {
            long attempt = state.begin(now);
            assertTrue(attempt > 0);
            assertEquals(0, state.begin(now));
            assertTrue(state.fail(attempt, now));
            assertEquals(delay, state.remainingDelay(now));
            assertEquals(0, state.begin(now + delay - 1));
            now += delay;
        }
        assertTrue(state.succeed(state.begin(now)));
        assertTrue(state.isInitialized());
        assertEquals(0, state.begin(now + 60_000));
    }

    @Test
    public void ignoresOldAndDuplicateInitializationCallbacks() {
        AdInitializationState state = new AdInitializationState();
        long first = state.begin(0);
        assertTrue(state.fail(first, 0));
        long second = state.begin(5_000);
        assertFalse(state.succeed(first));
        assertFalse(state.fail(first, 5_000));
        assertTrue(state.succeed(second));
        assertFalse(state.succeed(second));
        assertFalse(state.fail(second, 5_000));
    }

    @Test
    public void destructionIsTerminalDuringInitializationAndRetry() {
        AdInitializationState state = new AdInitializationState();
        long attempt = state.begin(0);
        state.destroy();
        assertTrue(state.isDestroyed());
        assertFalse(state.succeed(attempt));
        assertFalse(state.fail(attempt, 0));
        assertEquals(0, state.begin(60_000));
    }
}
