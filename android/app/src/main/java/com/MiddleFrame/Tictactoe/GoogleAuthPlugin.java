package com.MiddleFrame.Tictactoe;

import android.os.CancellationSignal;
import androidx.core.content.ContextCompat;
import androidx.credentials.Credential;
import androidx.credentials.CredentialManager;
import androidx.credentials.CredentialManagerCallback;
import androidx.credentials.CustomCredential;
import androidx.credentials.GetCredentialRequest;
import androidx.credentials.GetCredentialResponse;
import androidx.credentials.exceptions.GetCredentialException;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption;
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential;

@CapacitorPlugin(name = "GoogleAuth")
public class GoogleAuthPlugin extends Plugin {
    private CancellationSignal cancellationSignal;
    private final PendingRequest<PluginCall> pending = new PendingRequest<>();
    private boolean destroyed;

    @PluginMethod
    public void isAvailable(PluginCall call) {
        JSObject result = new JSObject();
        result.put("available", !BuildConfig.GOOGLE_AUTH_WEB_CLIENT_ID.isBlank());
        call.resolve(result);
    }

    @PluginMethod
    public synchronized void signIn(PluginCall call) {
        if (destroyed) {
            call.reject("google-sign-in-cancelled");
            return;
        }
        String nonce = call.getString("nonce");
        if (BuildConfig.GOOGLE_AUTH_WEB_CLIENT_ID.isBlank()) {
            call.reject("google-auth-unavailable");
            return;
        }
        if (nonce == null || nonce.isBlank()) {
            call.reject("google-nonce-missing");
            return;
        }
        if (pending.isPending()) {
            call.reject("google-sign-in-pending");
            return;
        }
        GetSignInWithGoogleOption option = new GetSignInWithGoogleOption.Builder(
            BuildConfig.GOOGLE_AUTH_WEB_CLIENT_ID
        ).setNonce(nonce).build();
        GetCredentialRequest request = new GetCredentialRequest.Builder()
            .addCredentialOption(option)
            .build();
        pending.start(call);
        cancellationSignal = new CancellationSignal();
        try {
            CredentialManager.create(getContext()).getCredentialAsync(
                getActivity(),
                request,
                cancellationSignal,
                ContextCompat.getMainExecutor(getContext()),
                new CredentialManagerCallback<GetCredentialResponse, GetCredentialException>() {
                    @Override
                    public void onResult(GetCredentialResponse response) {
                        resolveCredential(call, response.getCredential());
                    }

                    @Override
                    public void onError(GetCredentialException error) {
                        rejectPending(call, CredentialErrors.message(error));
                    }
                }
            );
        } catch (RuntimeException error) {
            rejectPending(call, "google-sign-in-failed");
        }
    }

    private void resolveCredential(PluginCall call, Credential credential) {
        if (!(credential instanceof CustomCredential customCredential)
            || !GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL.equals(credential.getType())) {
            rejectPending(call, "google-credential-invalid");
            return;
        }
        try {
            GoogleIdTokenCredential googleCredential = GoogleIdTokenCredential.createFrom(
                customCredential.getData()
            );
            JSObject result = new JSObject();
            result.put("idToken", googleCredential.getIdToken());
            resolvePending(call, result);
        } catch (RuntimeException error) {
            rejectPending(call, "google-token-invalid");
        }
    }

    private synchronized void resolvePending(PluginCall expected, JSObject result) {
        PluginCall call = pending.take(expected);
        if (call == null) return;
        cancellationSignal = null;
        call.resolve(result);
    }

    private synchronized void rejectPending(PluginCall expected, String message) {
        PluginCall call = pending.take(expected);
        if (call == null) return;
        cancellationSignal = null;
        call.reject(message);
    }

    @Override
    protected synchronized void handleOnDestroy() {
        destroyed = true;
        PluginCall call = pending.take();
        CancellationSignal signal = cancellationSignal;
        cancellationSignal = null;
        if (signal != null) signal.cancel();
        if (call != null) call.reject("google-sign-in-cancelled");
        super.handleOnDestroy();
    }
}
