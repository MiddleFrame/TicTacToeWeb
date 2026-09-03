# Android build identity

`app.properties` contains the application identity and SDK settings needed by the future Android shell.

The release keystore and its local password file are stored in `private/`. That directory is deliberately excluded from Git, but remains inside this folder when the project is copied or archived manually.

Before a release build, verify that the certificate fingerprint matches `signing-certificate.sha256`. Preserve the existing `applicationId`, key alias, keystore and certificate to keep Android updates compatible with the installed application.

Google account linking reads the OAuth web client ID from `private/google-auth.properties`. Copy `google-auth.properties.example` there and replace the example value after creating the Android and Web OAuth clients for `com.MiddleFrame.Tictactoe`.

## Release optimization

With the owner's approval, `android/gradle/rewarded-networks.gradle` uses MAS custom integration with AdMob, AppLovin and Unity Ads, including their AdMob/AppLovin mediation adapters. Other networks and the full bundle are not included. This follows [Yodo1's custom Android integration](https://developers.yodo1.com/docs/sdk/guides/android/integration/#customize-ad-networks); AdMob and AppLovin are mandatory. The resolved network list is checked before release builds. Fewer networks may affect fill rate and revenue; monitor both after rollout.

Keep rules supplied by the remaining SDKs are used unchanged. The removed full bundle included Vungle/Mintegral adapters that pinned all Google Play Services/AndroidX code. Refining those rules and generated resource-table keeps while retaining every SDK only reached 16% optimization, below the required threshold, so that configuration was not released.

The application's MAS keep rule preserves SDK code and adapter entry points, but excludes generated `R` and `R$*` resource identifier tables. Retaining those tables had pinned over 400,000 generated items. Referenced resource IDs remain available to Android's resource optimizer.

Missing-class suppression is limited to the Unity engine host referenced by MAS's unused Unity bridge and optional JVM TLS providers referenced by OkHttp 4.10. Android uses its platform TLS implementation. Do not add global `-ignorewarnings` or disable R8 optimization to bypass release failures.

R8 is pinned to 9.4.14 independently of AGP. The [Android configuration analyzer guide](https://developer.android.com/topic/performance/app-optimization/r8-configuration-analyzer) documents this setup. To regenerate its detailed report, run from `android`:

```powershell
.\gradlew.bat :app:bundleRelease -Dcom.android.tools.r8.dumpkeepradiushtmltodirectory=../work/r8-report
```

`bundleRelease` reads `BUNDLE-METADATA/com.android.tools/r8.json` from the actual signed bundle. It fails if any optimization, obfuscation or shrinking score is missing or below 25%. Scores are `100 - no*Percentage`, not the percentage of bytes removed. A compact result is saved to `android/app/build/reports/optimization/release.json`. Run `:app:testOptimizationVerification` to test the validator, including the threshold boundary and malformed metadata.

Release 47 (0.7.7) recorded 38.12% optimization, 38.35% obfuscation and 38.35% shrinking. Against the local release 46 bundle, uncompressed DEX decreased from 75,798,764 to 12,750,484 bytes; AAB size decreased from 53,088,805 to 13,585,072 bytes. These are local artifact measurements, not Play download-size or runtime RAM measurements.

After changing keep rules, test the release through Play internal testing: startup, Google account linking, Play Games and rewarded ads (completion grants one reward, early dismissal grants none). Build-time checks cannot validate SDK reflection or live ad delivery on a device. Play Console's processed result remains the final confirmation.
