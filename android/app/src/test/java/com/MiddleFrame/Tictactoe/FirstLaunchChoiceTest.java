package com.MiddleFrame.Tictactoe;

import static org.junit.Assert.*;
import java.util.ArrayDeque;
import java.util.concurrent.Executor;
import org.junit.Test;

public class FirstLaunchChoiceTest {
    private static final class Queue implements Executor {
        final ArrayDeque<Runnable> jobs = new ArrayDeque<>();
        public void execute(Runnable command) { jobs.add(command); }
        void next() { jobs.remove().run(); }
    }

    private static final class Storage implements FirstLaunchChoice.Storage {
        String saved;
        boolean succeed = true;
        boolean throwing;
        int writes;
        public String read() { return saved; }
        public boolean write(String world) {
            writes++;
            if (throwing) throw new IllegalStateException("unavailable");
            if (succeed) saved = world;
            return succeed;
        }
    }

    private static final class Observer implements FirstLaunchChoice.Listener {
        int starts;
        int failures;
        String world;
        public void saved(String value) { starts++; world = value; }
        public void failed() { failures++; }
    }

    @Test
    public void savesTheFirstChoiceBeforeLaunchingAndRejectsDoubleTaps() {
        Storage storage = new Storage();
        Queue io = new Queue();
        Queue ui = new Queue();
        Observer listener = new Observer();
        FirstLaunchChoice choice = new FirstLaunchChoice(storage, io, ui, listener);
        assertFalse(choice.select("TTTR"));
        assertTrue(choice.select("tttr"));
        assertFalse(choice.select("tttp"));
        assertNull(storage.read());
        assertEquals(0, listener.starts);
        io.next();
        assertEquals("tttr", storage.read());
        assertEquals(0, listener.starts);
        ui.next();
        assertEquals(1, listener.starts);
        assertEquals("tttr", listener.world);
        assertFalse(choice.select("tttp"));
        assertEquals(1, storage.writes);
    }

    @Test
    public void failedStorageDoesNotLaunchAndTheUserCanRetryTheChoice() {
        Storage storage = new Storage();
        storage.succeed = false;
        Queue io = new Queue();
        Queue ui = new Queue();
        Observer listener = new Observer();
        FirstLaunchChoice choice = new FirstLaunchChoice(storage, io, ui, listener);
        choice.select("tttp"); io.next(); ui.next();
        assertNull(storage.read());
        assertEquals(0, listener.starts);
        assertEquals(1, listener.failures);
        storage.succeed = true;
        choice.select("tttr"); io.next(); ui.next();
        assertEquals("tttr", storage.read());
        assertEquals(1, listener.starts);
    }

    @Test
    public void destructionKeepsCommittedChoiceButNeverLaunchesFromTheDeadScreen() {
        Storage storage = new Storage();
        Queue io = new Queue();
        Queue ui = new Queue();
        Observer listener = new Observer();
        FirstLaunchChoice choice = new FirstLaunchChoice(storage, io, ui, listener);
        choice.select("tttr");
        choice.close();
        io.next(); ui.next();
        assertEquals("tttr", storage.read());
        assertEquals(0, listener.starts);
        assertFalse(choice.select("tttp"));
        assertTrue(FirstLaunchChoice.valid(storage.read()));
    }

    @Test
    public void exceptionsAndLateUiCallbacksCannotFakeACompletedSelection() {
        Storage storage = new Storage();
        storage.throwing = true;
        Queue io = new Queue();
        Queue ui = new Queue();
        Observer listener = new Observer();
        FirstLaunchChoice choice = new FirstLaunchChoice(storage, io, ui, listener);
        choice.select("tttp"); io.next();
        choice.close(); ui.next();
        assertNull(storage.read());
        assertEquals(0, listener.starts);
        assertEquals(0, listener.failures);
    }
}
