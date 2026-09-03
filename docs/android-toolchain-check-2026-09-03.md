# Android toolchain control — 2026-09-03

## Scope

Compare the same 0.7.9 / versionCode 49 application, bundled web assets and selective 11-network MAS configuration with AGP 8.13.0 / Gradle 8.14.3 and AGP 9.3.2 / Gradle 9.5.0. R8 remains explicitly pinned to 9.4.14 in both builds. No vendor SDK versions, consumer rules, network selections or mediation routes are changed.

Release 48 / 0.7.8 is already installed from Google Play. Version 49 includes the account-deletion client previously deployed to the website, so comparing only its total AAB size with release 48 would mix application changes with the toolchain experiment. A fresh version-49 baseline was built first using the old tools.

## Compatibility changes

- Enable `buildFeatures.resValues`: the app declares the MAS app key as a generated resource, while AGP 9 disables this generation by default.
- Declare `androidx.core:core:$androidxCoreVersion` directly in the app. `MainActivity` calls `WindowCompat.enableEdgeToEdge`, added in Core 1.17.0. The existing root version is already 1.17.0, but relying on Capacitor's implementation dependency did not supply that API to the app compile classpath under the new toolchain. No edge-to-edge Java behavior is changed.
- Pin the Gradle distribution checksum. The downloaded 9.5.0 ZIP matched the official SHA-256: `553c78f50dafcd54d65b9a444649057857469edf836431389695608536d6b746`.
- Regenerate both wrapper launchers and the wrapper JAR using Gradle 9.5.0. The JAR matches the official SHA-256 `497c8c2a7e5031f6aa847f88104aa80a93532ec32ee17bdb8d1d2f67a194a9c7`. The checked-in `gradlew.bat` then downloaded and verified its distribution and successfully ran `:app:bundleRelease :app:testOptimizationVerification`.
- Keep Java 21, compile/target SDK 36 and min SDK 25. Do not adopt preview platform APIs or force newer, unapproved advertising SDK versions.

## Control artifacts

The old-toolchain baseline is preserved locally under `outputs/android-toolchain-control/0.7.9-49-agp-8.13.0.*`, including the signed AAB, R8 scores, resolved MAS dependencies and merged keep rules. Build artifacts and large analyzer reports remain ignored by Git; the reproducible configuration and measured conclusions are committed instead.

The baseline AAB is 35,183,682 bytes. Its four DEX files total 35,745,368 uncompressed bytes; embedded scores are 27.05% optimization, 27.16% obfuscation and 27.16% shrinking. These scores are coverage measurements, not percentages of archive size saved. Neither AAB size nor DEX size is runtime RAM.

## Result

Both controlled builds succeeded, including the embedded-score threshold checks and Android release lint. The new toolchain is retained for the version-49 candidate; it is not presented as a fix for vendor keep rules.

| Measurement | AGP 8.13.0 / Gradle 8.14.3 | AGP 9.3.2 / Gradle 9.5.0 |
| --- | ---: | ---: |
| Optimization | 27.05% | 27.02% |
| Obfuscation | 27.16% | 27.15% |
| Shrinking | 27.16% | 27.14% |
| AAB bytes | 35,183,682 | 35,035,744 |
| Uncompressed DEX bytes | 35,745,368 | 35,530,316 |
| DEX files | 4 | 4 |

The AAB is smaller by 147,938 bytes (0.42%) and DEX by 215,052 bytes (0.60%). Coverage is essentially unchanged and slightly lower, with a minimum margin of 2.02 percentage points above the project's 25% release gate. There is no measured RAM or frame-rate improvement to claim from this build comparison.

The resolved MAS dependency reports are byte-identical. All 98 archive entries under `base/assets/` and `base/lib/` match by SHA-256 between the two builds. The AAB's own metadata confirms AGP 9.3.2 and R8 9.4.14. No additional network or route was removed.

The candidate is `outputs/tic-tac-toe-plus-0.7.9-49.aab`, SHA-256 `95411a6830aa45da46c1212b757e3b4483dcc284011fd016842d5403e1a8b6aa`. The signed JAR verifies and its certificate SHA-256 matches `android-config/signing-certificate.sha256`. Java reports the existing self-signed certificate/trust and ZIP entry-order warnings; the signing identity was not changed. It has not been uploaded to Play or installed on the phone.

Google's standalone bundletool 1.18.3 validates the AAB successfully. Its manifest confirms the original package, version 49 / 0.7.9, min SDK 25, target SDK 36 and portrait MainActivity. `assembleRelease` also produced `outputs/tic-tac-toe-plus-0.7.9-49.apk` (25,415,518 bytes); `apksigner verify` passes with the original signing certificate. Keep this APK for local testing only; do not uninstall the Play installation to work around a signing mismatch.

One intermediate APK build reported a modified Gradle transform-cache entry for `jetified-applovin-adapter-5.2.0`. No dependency cache files were edited by this experiment. The build succeeded, and the subsequent canonical-wrapper AAB build did not repeat that warning. If it returns, investigate the specific cache entry before changing SDK code or suppressing warnings.

All 116 automated tests, ESLint and the production web build passed. The new regression test covers toolchain pins, the wrapper checksum, explicit Core dependency, resource generation and release optimization flags.

## Vendor findings

On this date both Yodo1's public changelog and Maven Central metadata list MAS 4.18.1 as the latest release. The existing selective-network audit remains applicable: see [NETWORK_OPTIMIZATION.md](../android-config/NETWORK_OPTIMIZATION.md).

The baseline merged configuration attributes global `-ignorewarnings` to `pag-sdk-ad-unfat-7909-20260204213520-release` in Pangle's dependency chain. R8 reports unresolved Google BillingClient classes referenced by TikTok purchase-tracking code, two ByteDance types and Meta's `Nullsafe` annotations. Those warnings recur with the new toolchain. We have not added BillingClient, global warning suppression or changes inside vendor AARs. Successful compilation alone does not prove those optional SDK paths are safe at runtime.

The [English support request](yodo1-r8-support-request.md) asks Yodo1 for approved narrower rules, missing-class handling, supported SDK updates, rewarded-only dependency guidance and AGP/R8 compatibility. It is prepared for the owner to forward, not sent automatically.

## Device check already completed on release 48

Read-only ADB diagnostics confirmed the installed Play build is 48 / 0.7.8 on Android 15. The owner manually backgrounded and reopened the game: music stopped in the background, then music, screen and animated menu background resumed. Background samples showed approximately 0.58% of one CPU core in the main process and 0% in the WebView renderer over 10.35 seconds. Combined main/renderer PSS fell from roughly 282 MiB in the foreground to 238 MiB after the background wait; graphics PSS fell from roughly 46.6 to 6.6 MiB.

These short samples are not a leak test, an in-match pause test, or a comparison of version 48 with version 49. PSS is not the same metric as Android vitals' anonymous RSS plus swap. The Play build was neither debuggable nor profileable, so no Android Studio heap profile was taken. No APK was installed, no application data was cleared and no emulator was started.

## Required device checks before rollout

Use Google Play internal testing to update the existing installation without clearing data. Confirm startup/offline play, safe-area layout, background/resume during a match, Google account linking and Play Games. Test rewarded-ad completion grants exactly one reward and early dismissal grants none. Test account deletion only with a consenting disposable test account, including invalidation on a second device and clean recreation afterward.

Do not claim all 11 networks are runtime-validated from a single ad: mediation delivery depends on the backend configuration, availability and geography. The Play-processed metrics and release-device behavior remain the final checks. No website runtime code changed in this experiment, so there is no separate website deployment to perform.

## References

- [AGP 9.3 release notes and compatibility](https://developer.android.com/build/releases/agp-9-3-0-release-notes)
- [WindowCompat API](https://developer.android.com/reference/androidx/core/view/WindowCompat)
- [R8 optimization setup](https://developer.android.com/topic/performance/app-optimization/enable-app-optimization)
- [Yodo1 MAS changelog](https://developers.yodo1.com/docs/sdk/support/changelog/)
- [Yodo1 ProGuard guidance](https://developers.yodo1.com/docs/sdk/advanced/proguard/)
- [Google Play technical-quality requirements](https://support.google.com/googleplay/android-developer/answer/17492799)
