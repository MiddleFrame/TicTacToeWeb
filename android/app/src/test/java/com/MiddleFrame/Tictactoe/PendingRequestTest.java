package com.MiddleFrame.Tictactoe;

import static org.junit.Assert.*;
import org.junit.Test;

public class PendingRequestTest {
    @Test
    public void lateCallbackCannotCompleteTheNextRequest() {
        PendingRequest<Object> slot = new PendingRequest<>();
        Object first = new Object();
        Object second = new Object();
        assertTrue(slot.start(first));
        assertFalse(slot.start(second));
        assertSame(first, slot.take(first));
        assertTrue(slot.start(second));
        assertNull(slot.take(first));
        assertSame(second, slot.take(second));
        assertFalse(slot.isPending());
    }

    @Test
    public void earnedCloseDestroyAndDuplicateCallbacksSettleOnlyOnce() {
        PendingRequest<Object> slot = new PendingRequest<>();
        Object request = new Object();
        assertTrue(slot.start(request));
        assertSame(request, slot.take());
        assertNull(slot.take());
        assertNull(slot.take(request));
        assertFalse(slot.isPending());
    }
}
