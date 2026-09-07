package com.MiddleFrame.Tictactoe;

import androidx.credentials.exceptions.GetCredentialCancellationException;
import androidx.credentials.exceptions.GetCredentialException;
import androidx.credentials.exceptions.NoCredentialException;

final class CredentialErrors {
    private CredentialErrors() {}

    static String message(GetCredentialException error) {
        if (error instanceof GetCredentialCancellationException) return "google-sign-in-cancelled";
        if (error instanceof NoCredentialException) return "google-sign-in-unavailable";
        return "google-sign-in-failed";
    }
}
