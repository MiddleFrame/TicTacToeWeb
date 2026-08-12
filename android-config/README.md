# Android build identity

`app.properties` contains the application identity and SDK settings needed by the future Android shell.

The release keystore and its local password file are stored in `private/`. That directory is deliberately excluded from Git, but remains inside this folder when the project is copied or archived manually.

Before a release build, verify that the certificate fingerprint matches `signing-certificate.sha256`. Preserve the existing `applicationId`, key alias, keystore and certificate to keep Android updates compatible with the installed application.
