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
    private PluginCall pendingCall;

    @PluginMethod
    public void isAvailable(PluginCall call) {
        JSObject result = new JSObject();
        result.put("available", !BuildConfig.GOOGLE_AUTH_WEB_CLIENT_ID.isBlank());
        call.resolve(result);
    }

    @PluginMethod
    public void signIn(PluginCall call) {
        String nonce = call.getString("nonce");
        if (BuildConfig.GOOGLE_AUTH_WEB_CLIENT_ID.isBlank()) {
            call.reject("google-auth-unavailable");
            return;
        }
        if (nonce == null || nonce.isBlank()) {
            call.reject("google-nonce-missing");
            return;
        }
        if (pendingCall != null) {
            call.reject("google-sign-in-pending");
            return;
        }
        GetSignInWithGoogleOption option = new GetSignInWithGoogleOption.Builder(
            BuildConfig.GOOGLE_AUTH_WEB_CLIENT_ID
        ).setNonce(nonce).build();
        GetCredentialRequest request = new GetCredentialRequest.Builder()
            .addCredentialOption(option)
            .build();
        pendingCall = call;
        cancellationSignal = new CancellationSignal();
        CredentialManager.create(getContext()).getCredentialAsync(
            getActivity(),
            request,
            cancellationSignal,
            ContextCompat.getMainExecutor(getContext()),
            new CredentialManagerCallback<GetCredentialResponse, GetCredentialException>() {
                @Override
                public void onResult(GetCredentialResponse response) {
                    resolveCredential(response.getCredential());
                }

                @Override
                public void onError(GetCredentialException error) {
                    rejectPending(error.getType());
                }
            }
        );
    }

    private void resolveCredential(Credential credential) {
        if (!(credential instanceof CustomCredential customCredential)
            || !GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL.equals(credential.getType())) {
            rejectPending("google-credential-invalid");
            return;
        }
        try {
            GoogleIdTokenCredential googleCredential = GoogleIdTokenCredential.createFrom(
                customCredential.getData()
            );
            JSObject result = new JSObject();
            result.put("idToken", googleCredential.getIdToken());
            resolvePending(result);
        } catch (RuntimeException error) {
            rejectPending("google-token-invalid");
        }
    }

    private void resolvePending(JSObject result) {
        if (pendingCall == null) return;
        pendingCall.resolve(result);
        clearPending();
    }

    private void rejectPending(String message) {
        if (pendingCall == null) return;
        pendingCall.reject(message == null ? "google-sign-in-failed" : message);
        clearPending();
    }

    private void clearPending() {
        pendingCall = null;
        cancellationSignal = null;
    }

    @Override
    protected void handleOnDestroy() {
        if (cancellationSignal != null) cancellationSignal.cancel();
        rejectPending("google-sign-in-cancelled");
        super.handleOnDestroy();
    }
}
