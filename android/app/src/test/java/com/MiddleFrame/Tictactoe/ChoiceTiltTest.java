package com.MiddleFrame.Tictactoe;

import static org.junit.Assert.*;
import org.junit.Test;

public class ChoiceTiltTest {
    @Test
    public void calibratesAtTheCurrentPhonePoseAndBoundsMotionInBothDirections() {
        ChoiceTilt tilt = new ChoiceTilt();
        assertTrue(tilt.update(-1.4f, .2f));
        assertEquals(0, tilt.x(), .001f);
        assertEquals(0, tilt.y(), .001f);
        tilt.update(-1.3f, .3f);
        assertEquals(-1.8f, tilt.x(), .001f);
        assertEquals(1.8f, tilt.y(), .001f);
        tilt.update(.1f, -1.5f);
        assertEquals(-5, tilt.x(), .001f);
        assertEquals(-5, tilt.y(), .001f);
    }

    @Test
    public void handlesAngleWrapAndRecalibratesAfterPauseWithoutAcceptingInvalidInput() {
        ChoiceTilt tilt = new ChoiceTilt();
        assertFalse(tilt.update(Float.NaN, 0));
        tilt.update(0, 3.13f);
        tilt.update(0, -3.13f);
        assertTrue(Math.abs(tilt.y()) < 1);
        float previous = tilt.y();
        assertFalse(tilt.update(0, Float.POSITIVE_INFINITY));
        assertEquals(previous, tilt.y(), .001f);
        tilt.reset();
        tilt.update(1.5f, -1.2f);
        assertEquals(0, tilt.x(), .001f);
        assertEquals(0, tilt.y(), .001f);
    }
}
