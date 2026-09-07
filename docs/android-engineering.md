# Android engineering gates

Updated 2026-09-07. This document describes the maintained checks added after the [measured audit](technical-architecture-android-audit.md). The audit remains the historical baseline; a higher R8 percentage is not evidence of faster startup, lower memory use, or improved ranking.

## Boundaries and compatibility

`GoogleAuthPlugin` owns the Android credential request and cancellation lifecycle. `PendingRequest` allows a result to consume only its own pending request; completion clears ownership before resolving JavaScript. `CredentialErrors` classifies the public Credential Manager exception classes instead of calling the restricted exception `getType()` API. Provider exception details and tokens are not logged.

`RewardedAdsPlugin` owns platform calls and existing privacy preferences. SDK calls and callback processing run on the main thread. `AdInitializationState` owns initialization generations and a bounded retry delay: 5, 10, 20, 40, then 60 seconds. Retries require previously configured privacy and an active application; pause removes the retry timer and resume respects the remaining delay. Destroy is terminal. `RewardedAdCallbacks` is a weak adapter so an SDK singleton does not retain the destroyed plugin through its listener. Pending and queued JavaScript requests are rejected on destruction.

Rewarded completion remains driven by the vendor earned callback. A request settles once, and another show is blocked until the prior ad closes even if its earned callback already resolved the request. This does not turn a client callback into trusted server reward proof. Recovery covers an explicit initialization failure; a vendor initialization that never calls back still needs SDK diagnostics. MAS callbacks do not provide a per-show request identifier; vendor callback ordering, Activity recreation during an ad, account changes, and recovery on real devices still need integration testing. The existing placement, amount, COPPA/GDPR/CCPA decisions, SDK versions, networks and signature configuration are unchanged.

The supported web engine is Chromium 111 or newer, approved by the owner on 2026-09-07. Android minSdk remains 25. `build/android-webview-policy.ts` supplies both Vite's explicit `chrome111` target and Capacitor's `minWebViewVersion`. `server.errorPath` opens the packaged `webview-update.html`; this page is static RU/EN HTML with no plugin calls, remote assets, automatic installation, or external redirect. Capacitor disables plugins on its error page. See the [Capacitor configuration reference](https://capacitorjs.com/docs/config) and [Vite build target reference](https://vite.dev/config/build-options#build-target).

Some providers, including Huawei, have separate provider-version checks in Capacitor. The generated Android index therefore starts with an ES5 preflight and removes module-preload links. It loads the application module only after a Chrome/Chromium UA major of at least 111 is detected and the DOM is ready. Older or unrecognized engines get the local update page. An unrecognized UA is intentionally rejected; this is a compatibility guard, not a security boundary. VM tests cover old, current, and unknown engines, the order of module loading, and malformed build output. Device startup/rendering measurements have not been substituted with these tests.

## Release policy and measurements

`android-config/release-policy.json` is the reviewed policy. Changing a limit requires fresh baseline evidence and a reason in the change description. Do not raise a limit just to clear a failed build.

`verifyReleasePolicy`, attached to `preReleaseBuild`, checks Java/Gradle, SDK levels, production network and ABI configuration, and every actually resolved `com.yodo1.mas*` component version in `releaseRuntimeClasspath`. Existing network verification also checks the exact permitted MAS module set. App-owned global R8 disabling and broad warning suppressions are rejected. Vendor AAR consumer rules are not rewritten.

The production policy also applies to `-PmasNetworkProfile`; selecting a different profile cannot bypass it. The historical leave-one-out matrix predates this gate and can be reproduced from the audit's recorded source revision. Future controlled experiments need a separate ignored checkout with a temporary, explicitly experimental policy, an experimental result marker, isolated output paths, and publication disabled. The current production tasks do not implement that experimental workflow. Do not use `-x` to skip production verification or commit experimental network removals. A dedicated experimental task is a separate future improvement.

After `bundleRelease`, the gate checks the AAB's embedded AGP/R8 versions, release/full-mode optimization flags, resource shrinking, and packaged WebView policy/fallback. It scans raw DEX entries including the Meta asset DEX. It reports R8-managed and all-packaged DEX separately. Class definitions and physical method-ID table slots are counted; method IDs include references and are not method definitions. Native entries across all bundle modules must match the allowed ABI paths and ELF architecture, contain PT_LOAD segments with power-of-two alignment of at least 16 KiB, and have congruent file offsets/virtual addresses at 16 KiB. These structural checks do not replace a 16 KiB device test or APK ZIP alignment verification; see [Android's page-size guide](https://developer.android.com/guide/practices/page-sizes).

| Metric | Maximum | Original audit baseline |
| --- | ---: | ---: |
| AAB bytes | 38,500,000 | 35,039,520 |
| All packaged DEX bytes | 42,500,000 | 40,548,224 |
| Class definitions | 45,000 | 42,208 |
| Method-ID slots, including references | 286,000 | 272,189 |
| Native uncompressed bytes | 3,650,000 | 3,460,752 |
| Native libraries | 20 | 20 |
| Packaged web asset bytes | 1,500,000 | 1,153,777 |

The JSON result is `android/app/build/reports/optimization/artifact-budget.json`. `testReleasePolicy` exercises budget boundaries, malformed/non-finite values, ELF32/64 with both byte orders, and rejected ELF alignments. Existing optimization verification separately enforces the three R8 coverage thresholds. `docs/audit-support/measure-aab.py` independently measures the artifact, including method definitions, for audit comparisons.

From the repository root, use the supported Java 21 and SDK installation, then run one Gradle process at a time:

```powershell
pnpm android:web
pnpm exec cap sync android
android/gradlew.bat -p android :app:bundleRelease :app:assembleRelease :app:testDebugUnitTest :app:testReleasePolicy :app:testOptimizationVerification --max-workers=2 '-Dorg.gradle.jvmargs=-Xmx4096m'
```

This builds locally and does not install, upload, or publish Android. Keep signed artifacts and raw machine logs ignored. Capacitor sync can rewrite generated package-manager paths in `capacitor.settings.gradle`; review those changes separately from production configuration.

## Full lint versus regression status

Run full native lint separately after the release build and capture its start time before Gradle. `--rerun-tasks` ensures the report is fresh; a cached report is not accepted as new evidence.

```powershell
$lintStartedAt = (Get-Date).ToUniversalTime().ToString('o')
android/gradlew.bat -p android :app:lintRelease --rerun-tasks --max-workers=2 '-Dorg.gradle.jvmargs=-Xmx4096m'
node scripts/check-android-lint.mjs --report android/app/build/intermediates/lint_intermediate_text_report/release/lintReportRelease/lint-results-release.txt --started-at $lintStartedAt --output work/android-lint-regression.json
```

The checker does not alter Gradle's result. Full lint remains failed when a known error is present. Exit zero from the checker means only that no new errors were found. `android-config/lint-known-issues.json` currently permits one exact `NotificationPermission` issue rooted in Picasso's `RemoteViewsAction.NotificationAction`, with owner, maximum count, and a review deadline of 2026-10-07. A changed message/source, additional occurrence, new error, expired exception, mismatched totals, or stale report fails the regression check. Warnings remain visible in the counts. Do not add a notification permission to silence unused vendor functionality, globally suppress lint, or present this check as full lint success.

The former `RestrictedApi` error was fixed in app code. The machine-only SDK properties issue is repaired through the writer below; neither error is allowlisted. Use official [Credential Manager troubleshooting](https://developer.android.com/identity/sign-in/credential-manager-troubleshooting-guide) and [Yodo1 Android integration](https://developers.yodo1.com/docs/sdk/guides/android/integration/) guidance when reviewing future SDK changes.

## SDK location configuration

`node scripts/write-android-sdk-location.mjs --sdk-dir <absolute-existing-sdk-directory>` creates `android/local.properties` only if absent, with Java-properties-safe path escaping. It never prints the path or file contents. For an existing file, explicit `--repair` replaces only one simple `sdk.dir` line, preserves all other bytes, refuses ambiguous keys/continuations, and makes an ignored backup before an atomic replacement. The repair command is scoped to this repository's `android/local.properties`; it does not access signing configuration.

## Before commercial release

Keep native unit tests, the repository quality command, Android release policy/optimization checks, and the honest full-lint/regression pair in the release record. Clear the Picasso exception through a supported vendor change or reviewed evidence before its deadline. Test Google sign-in cancellation/recreation, rewarded failure/retry and background/resume, old/unknown WebView fallback, supported-provider startup, and 16 KiB runtime behavior on owner-authorized devices. Measure startup, PSS, CPU and WebView renders independently of bundle size and R8 coverage. APK installation or data changes on an owner's phone require their explicit permission.

## Verification of this change

The 2026-09-07 final local release completed in 356.77 seconds: bundle, APK, six native JUnit tests, release-policy tests, and optimization-verification tests passed. The independent AAB inspector matched the built-in gate: AAB 35,057,804 bytes; all five DEX files 40,556,968 bytes; four R8-managed DEX files 35,539,060 bytes; 42,217 class definitions, 242,773 method definitions, and 272,211 method-ID slots across all DEX. R8 coverage was 27.03% / 27.16% / 27.15%.

Compared with the original final audit AAB, this is +18,284 AAB bytes and +8,744 DEX bytes. All 20 native libraries and the embedded Meta DEX retained identical per-entry SHA-256 hashes. Native bytes remain 3,460,752; minimum PT_LOAD alignment is 16,384. Packaged web assets are 1,167,718 bytes. These are the cost of the fixes and guards, not measured startup or memory improvements.

Bundletool validation, AAB/APK signature verification, pinned APK certificate comparison, bundle `PAGE_ALIGNMENT_16K`, and APK `zipalign -P 16` all passed. Fresh full lint took 63.85 seconds and failed with **1 error / 19 warnings**; the regression checker accepted only the exact known Picasso issue. No app-owned lint error was allowlisted. Detailed local evidence is under ignored `work/android-hardening-2026-09-07/`. The AAB SHA-256 is `d42693e27a161962fe8063899cde271edeb36e8002bbebd5cca19d3d3ed4d2cb`. No Android build was installed or published.
