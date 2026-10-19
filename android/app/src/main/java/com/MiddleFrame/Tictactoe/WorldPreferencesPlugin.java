package com.MiddleFrame.Tictactoe;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "WorldPreferences")
public class WorldPreferencesPlugin extends Plugin {
    @PluginMethod
    public void read(PluginCall call) {
        try {
            JSObject result = new JSObject();
            result.put("world", new GameWorldPreferences(getContext()).read());
            call.resolve(result);
        } catch (RuntimeException error) {
            call.reject("World preference could not be read");
        }
    }

    @PluginMethod
    public void write(PluginCall call) {
        try {
            if (new GameWorldPreferences(getContext()).write(call.getString("world"))) {
                call.resolve();
                return;
            }
        } catch (RuntimeException error) {
            call.reject("World preference could not be stored");
            return;
        }
        call.reject("World preference could not be stored");
    }
}
