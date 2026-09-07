# Android audit: portable measurement and temporary profiles

Python 3.10+ with the standard library; verified with Python **3.12.13 and 3.13.0**. Keep `android_audit_common.py` beside both CLI scripts. No pip dependencies, network calls, Gradle execution, APK installation, manifest decoding or signing inspection occur inside these helpers. They never read `android-config/private`. Outputs are restricted to the checkout's ignored `work` directory; the AAB is only read, never copied or modified by the measurement helper.

After copying these support files to `docs/audit-support`, run from the repository root:

```powershell
python docs/audit-support/measure-aab.py --aab android/app/build/outputs/bundle/release/app-release.aab --output work/technical-audit-2026-09-07/repro/production-aab.json
python docs/audit-support/create-network-profiles.py --output-dir work/technical-audit-2026-09-07/repro/profiles
```

An explicit AAB may be outside the checkout. Relative input/output paths resolve against the detected repository root, not an arbitrary cwd. `--repo-root` is available when detection is ambiguous. The profile generator accepts `--source-profile` and `--catalog`; defaults are the checked-in `android-config/mas-networks.json` and `android-config/mas-network-catalog.json`. It preserves the remaining enabled networks and disabled routes, correctly mapping `applovin-*` mediators. Generated profiles and their index remain under ignored `work`; do not commit them.

The generator produces one profile per currently enabled network. AdMob/AppLovin omissions are marked as **rejected by existing project validation**, not supported integrations. Do not bypass mandatory-network validation to obtain a matrix number. The generator does not change production selection or execute builds.

## What the JSON measures

- Physical AAB size/SHA-256; total compressed/uncompressed ZIP member sizes, which exclude ZIP directory overhead from the compressed-member sum.
- All directly packaged standard DEX files discovered by **header**, including `base/assets/audience_network.dex`. Standard module `*/dex/*.dex` and additional asset DEX are separate; combined totals include both.
- DEX `class_defs_size`, encoded direct/virtual method definition counts and method/field ID slots. Slots include references and are summed without cross-file deduplication. Supported DEX versions are 035 and 037–040; compact DEX, version 041 containers and nested archives are not decoded and must not be silently treated as measured standard DEX. [AOSP DEX format](https://source.android.com/docs/core/runtime/dex-format).
- Native ELF sizes, hashes, PT_LOAD alignment and offset/virtual-address congruence at 16 KiB. This is not generated APK ZIP alignment or a runtime test on a 16 KiB device. [Android 16 KiB guidance](https://developer.android.com/guide/practices/page-sizes).
- Embedded R8 JSON and `100 - no*Percentage` coverage, plus an allowlisted AGP version property and compressed/uncompressed mapping-metadata size. The script does not output manifest identifiers or full assets.

Archive size is not Play's device-specific download size. R8 coverage is not bytes saved, startup, RAM, CPU, stability or a forecast of ranking. Header discovery finds direct members, not DEX hidden inside a nested ZIP/JAR. A malformed/unsupported direct DEX or missing R8 scores makes the helper fail instead of emitting a partial success.

Verified against the preserved audit baseline `664997a587b4e78f410baf1cf62b271f23eb2572474214a4acb37ae56584f389`: AAB **35,039,533 B**, regular DEX **35,530,316 B / 38,973 classes / 219,001 methods**, all packaged DEX **40,548,224 B / 42,208 classes / 242,732 methods**, native **20 / 3,460,752 B**, coverage **27.02 / 27.15 / 27.14%**. All 20 ELF alignment/congruence checks pass. These numbers describe that baseline, not every future release.

The reviewed [measurement summary](android-measurements.json) records the audit's exact baseline and variants without experimental configuration files or raw build artifacts.

## Controlled release matrix

1. Record the source commit and pending source diff, lockfile, Java/AGP/Gradle/R8 versions and hashes of production profile/catalog. Prepare web assets once with the existing `pnpm run android:web` and `pnpm exec cap sync android`. Record hashes of `android/app/src/main/assets`; do not sync or rebuild web assets between variants. Keep SDK versions, toolchain, app version, signing configuration and all other release inputs fixed.
2. From `android`, create a fresh production baseline with the existing tasks below. Preserve its AAB and fresh outputs under a unique ignored work directory before the next build overwrites them. Never reuse an old AAB after a failed build.

```powershell
.\gradlew.bat :app:bundleRelease :app:testOptimizationVerification --max-workers=2 '-Dorg.gradle.jvmargs=-Xmx4g'
.\gradlew.bat :app:analyzeReleaseR8Config --max-workers=2 '-Dorg.gradle.jvmargs=-Xmx4g'
```

3. Generate temporary profiles. Run one supported variant at a time, passing its **absolute** profile path. For example, from `android`:

```powershell
$auditProfile = (Resolve-Path ../work/technical-audit-2026-09-07/repro/profiles/without-bigo/profile.json).Path
.\gradlew.bat :app:bundleRelease :app:testOptimizationVerification "-PmasNetworkProfile=$auditProfile" --max-workers=2 '-Dorg.gradle.jvmargs=-Xmx4g'
.\gradlew.bat :app:analyzeReleaseR8Config "-PmasNetworkProfile=$auditProfile" --max-workers=2 '-Dorg.gradle.jvmargs=-Xmx4g'
```

4. After each successful release, run `measure-aab.py` on that exact AAB with a unique output JSON. Save matching `android/app/build/outputs/mapping/release/{mapping,usage,seeds,configuration}.txt`, `configanalyzer.pb`, `configanalyzer.html` if produced, and `android/app/build/reports/optimization/networks.json` under the same ignored variant directory. Record task exit codes, file timestamps and SHA-256 so stale mapping/analyzer files cannot be mistaken for fresh outputs. Keep full artifacts out of `docs`; copy only reviewed small summaries. [R8 Configuration Analyzer](https://developer.android.com/topic/performance/app-optimization/r8-configuration-analyzer).
5. A failed R8 run is a recorded matrix outcome with **no new size/coverage result**. Save its failure log and resolved dependency/rule evidence. Never add blanket suppression, patch vendor consumer rules, force unapproved versions or disable release gates to fill a table. Excluding a mediator also removes its routes; record that in the cost interpretation.
6. Compute marginal cost as baseline minus variant for AAB, regular/all DEX, classes/methods and native libraries. Compare keep origins and graph changes, not overlapping vendor counts. Mapping line counts are not DEX method definitions. Technical savings alone do not establish route safety, fill rate or revenue. Restore/check the production profile and finish with a fresh production release verification; do not upload or install the result as part of measurement.

## Narrow why-are-you-keeping diagnostics

Create a small `.pro` file under ignored work containing only targeted diagnostics, for example `-whyareyoukeeping class com.yodo1.mas.reward.Yodo1MasRewardAd`. Attach it using a temporary Gradle init script outside production source:

```groovy
gradle.afterProject { project ->
    if (project.path == ':app') {
        def diagnosticRules = project.providers.gradleProperty('auditWhyRules').orNull
        if (diagnosticRules) project.android.buildTypes.release.proguardFiles(project.file(diagnosticRules))
    }
}
```

Pass absolute paths via `-I <temporary-init.gradle>` and `-PauditWhyRules=<temporary-rules.pro>` on a separate diagnostic release run. Save its output separately; adding whykeeping queries is not a vendor keep-rule modification. Use exact classes discovered in the same resolved graph. Do not confuse a whykeeping trace or Analyzer coverage with final embedded AAB coverage, and do not overwrite the control artifact with the diagnostic output.
