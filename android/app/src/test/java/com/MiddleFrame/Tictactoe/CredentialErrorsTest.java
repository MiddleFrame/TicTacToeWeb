package com.MiddleFrame.Tictactoe;

import static org.junit.Assert.assertEquals;
import androidx.credentials.exceptions.GetCredentialCancellationException;
import androidx.credentials.exceptions.GetCredentialUnknownException;
import androidx.credentials.exceptions.NoCredentialException;
import org.junit.Test;

public class CredentialErrorsTest {
    @Test
    public void classifiesPublicExceptionTypesWithoutExposingProviderMessages() {
        assertEquals("google-sign-in-cancelled", CredentialErrors.message(new GetCredentialCancellationException("provider details")));
        assertEquals("google-sign-in-unavailable", CredentialErrors.message(new NoCredentialException("provider details")));
        assertEquals("google-sign-in-failed", CredentialErrors.message(new GetCredentialUnknownException("provider details")));
    }
}
