# Android build identity

`app.properties` contains the Android application's identity, release version and SDK settings.

The release keystore and its local password file are stored in `private/`. That directory is deliberately excluded from Git, but remains inside this folder when the project is copied or archived manually.

Before a release build, verify that the certificate fingerprint matches `signing-certificate.sha256`. Preserve the existing `applicationId`, key alias, keystore and certificate to keep Android updates compatible with the installed application.

Google account linking reads the OAuth web client ID from `private/google-auth.properties`. Copy `google-auth.properties.example` there and replace the example value after creating the Android and Web OAuth clients for `com.MiddleFrame.Tictactoe`.

## Release optimization

With the owner's approval, `android/gradle/rewarded-networks.gradle` uses MAS custom integration. `mas-networks.json` selects networks and disabled mediation routes; `mas-network-catalog.json` records the commercial networks and supported routes from MAS 4.18.1's full POM. This follows [Yodo1's custom Android integration](https://developers.yodo1.com/docs/sdk/guides/android/integration/#customize-ad-networks); AdMob and AppLovin are mandatory.

Release 48 restores 11 of the 14 commercial networks instead of retaining just three. It excludes BidMachine, TopOn and Vungle. Mintegral remains available through AdMob/AppLovin; only its ironSource adapter is excluded because it pins all AndroidX code. The Yodo1 test-ad network is not a production advertising network and is not included. See [the measured network audit](NETWORK_OPTIMIZATION.md) for evidence and limitations.

Keep rules supplied by the remaining SDKs are used unchanged. All supported routes between included networks and mediators are added except the explicit disabled routes. The complete resolved MAS dependency set is checked before every release build and saved to `android/app/build/reports/optimization/networks.json`. Fewer networks or routes may affect fill rate and revenue; monitor both after rollout.

The application's MAS keep rule preserves SDK code and adapter entry points, but excludes generated `R` and `R$*` resource identifier tables. Retaining those tables had pinned over 400,000 generated items. Referenced resource IDs remain available to Android's resource optimizer.

App-owned missing-class suppression is limited to the Unity engine host referenced by MAS's unused Unity bridge and optional JVM TLS providers referenced by OkHttp 4.10. Android uses its platform TLS implementation. The Pangle dependency chain independently supplies global `-ignorewarnings` and leaves several unresolved optional SDK references; this is documented in the [Yodo1 support request](../docs/yodo1-r8-support-request.md). Do not add global `-ignorewarnings` or disable R8 optimization to bypass release failures.

The version-49 candidate uses AGP 9.3.2, Gradle 9.5.0 with a pinned distribution SHA-256, and Java 21. It explicitly enables generated resource values and declares AndroidX Core 1.17.0 for the app's edge-to-edge API. Keep these declarations when syncing Capacitor. Jetifier remains enabled because SDK dependencies still contain legacy support-library references; its deprecation does not justify disabling it without testing those dependencies.

R8 is pinned to 9.4.14 independently of AGP. The [Android configuration analyzer guide](https://developer.android.com/topic/performance/app-optimization/r8-configuration-analyzer) documents this setup. To regenerate its detailed report, run from `android`:

```powershell
.\gradlew.bat :app:bundleRelease -Dcom.android.tools.r8.dumpkeepradiushtmltodirectory=../work/r8-report
```

`bundleRelease` reads `BUNDLE-METADATA/com.android.tools/r8.json` from the actual signed bundle. It fails if any optimization, obfuscation or shrinking score is missing or below 25%. Scores are `100 - no*Percentage`, not the percentage of bytes removed. A compact result is saved to `android/app/build/reports/optimization/release.json`. Run `:app:testOptimizationVerification` to test the validator, including the threshold boundary and malformed metadata.

Release 48 (0.7.8), with 11 networks, records 27.05% optimization, 27.16% obfuscation and 27.16% shrinking. The previous three-network release 47 recorded 38.12%, 38.35% and 38.35%. Candidate 49 (0.7.9), with the same 11 networks and newer AGP/Gradle, records 27.02%, 27.15% and 27.14%. The current threshold margin is only 2.02 percentage points: always inspect the new AAB after dependency changes. These are embedded R8 measurements, not Play download-size or runtime RAM measurements.

The [controlled toolchain comparison](../docs/android-toolchain-check-2026-09-03.md) found only 0.42% smaller AAB and 0.60% smaller DEX with no coverage improvement. Upgrading build tools alone did not resolve the advertising libraries' keep-rule restrictions. The candidate has not yet been device-tested or processed by Play.

After changing keep rules, test the release through Play internal testing: startup, Google account linking, Play Games and rewarded ads (completion grants one reward, early dismissal grants none). Build-time checks cannot validate SDK reflection or live ad delivery on a device. Play Console's processed result remains the final confirmation.
