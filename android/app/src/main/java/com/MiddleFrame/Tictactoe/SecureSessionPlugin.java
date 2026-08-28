package com.MiddleFrame.Tictactoe;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

@CapacitorPlugin(name = "SecureSession")
public class SecureSessionPlugin extends Plugin {
    private static final String KEY_ALIAS = "tttp_session_key";
    private static final String PREFERENCES = "tttp_secure_session";
    private static final String TOKEN = "token";

    @PluginMethod
    public void getToken(PluginCall call) {
        JSObject result = new JSObject();
        try {
            String encoded = preferences().getString(TOKEN, null);
            result.put("value", encoded == null ? null : decrypt(encoded));
        } catch (Exception error) {
            preferences().edit().remove(TOKEN).apply();
            result.put("value", null);
        }
        call.resolve(result);
    }

    @PluginMethod
    public void setToken(PluginCall call) {
        String value = call.getString("value");
        if (value == null || !value.matches("[a-f0-9]{64}")) {
            call.reject("Invalid session token");
            return;
        }
        try {
            preferences().edit().putString(TOKEN, encrypt(value)).apply();
            call.resolve();
        } catch (Exception error) {
            call.reject("Session token could not be stored");
        }
    }

    @PluginMethod
    public void removeToken(PluginCall call) {
        preferences().edit().remove(TOKEN).apply();
        call.resolve();
    }

    private SharedPreferences preferences() {
        return getContext().getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE);
    }

    private SecretKey key() throws Exception {
        KeyStore keyStore = KeyStore.getInstance("AndroidKeyStore");
        keyStore.load(null);
        if (keyStore.containsAlias(KEY_ALIAS)) {
            return ((KeyStore.SecretKeyEntry) keyStore.getEntry(KEY_ALIAS, null)).getSecretKey();
        }
        KeyGenerator generator = KeyGenerator.getInstance(
            KeyProperties.KEY_ALGORITHM_AES,
            "AndroidKeyStore"
        );
        generator.init(new KeyGenParameterSpec.Builder(
            KEY_ALIAS,
            KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT
        )
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .build());
        return generator.generateKey();
    }

    private String encrypt(String value) throws Exception {
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, key());
        byte[] encrypted = cipher.doFinal(value.getBytes(StandardCharsets.UTF_8));
        byte[] iv = cipher.getIV();
        ByteBuffer buffer = ByteBuffer.allocate(4 + iv.length + encrypted.length);
        buffer.putInt(iv.length);
        buffer.put(iv);
        buffer.put(encrypted);
        return Base64.encodeToString(buffer.array(), Base64.NO_WRAP);
    }

    private String decrypt(String encoded) throws Exception {
        ByteBuffer buffer = ByteBuffer.wrap(Base64.decode(encoded, Base64.NO_WRAP));
        int ivLength = buffer.getInt();
        if (ivLength < 12 || ivLength > 16) throw new IllegalArgumentException();
        byte[] iv = new byte[ivLength];
        buffer.get(iv);
        byte[] encrypted = new byte[buffer.remaining()];
        buffer.get(encrypted);
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.DECRYPT_MODE, key(), new GCMParameterSpec(128, iv));
        return new String(cipher.doFinal(encrypted), StandardCharsets.UTF_8);
    }
}
