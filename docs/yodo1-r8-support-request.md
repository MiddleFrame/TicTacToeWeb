# Email to Yodo1 MAS technical support

Subject: MAS 4.18.1 Android — broad consumer keep rules limit R8 optimization; request for supported configuration and SDK roadmap

Hello Yodo1 technical team,

We develop Tic Tac Toe Plus, an Android game distributed on Google Play (package: `com.MiddleFrame.Tictactoe`). We use Yodo1 MAS for rewarded video only. We would like your help improving R8 optimization while preserving mediation compatibility, ad availability and correct reward callbacks.

## Why we are contacting you

Google Play now displays DEX optimization, obfuscation and shrinking coverage, and flags our current build as having a medium optimization level at approximately 27% in each category. We want to improve the actual code footprint and maintain sufficient headroom as the SDKs evolve, not merely pass a minimum threshold.

We understand that the announced February 2027 minimum of 25% applies to games with more than 50 MB of DEX code. We are not claiming that our current build is already restricted or that a higher R8 percentage automatically guarantees better ranking. However, the earlier full integration exceeded that DEX size, and technical quality, memory use, startup performance and future Play compatibility are important to us.

## Baseline environment

- MAS: 4.18.1; your public changelog and the Maven Central metadata for `com.yodo1.mas:core` and `full` still list this as the latest release when checked on September 3, 2026.
- Android Gradle Plugin: 8.13.0; Gradle: 8.14.3; Java: 21.
- R8: explicitly pinned to 9.4.14 independently of AGP.
- `minSdk = 25`, `targetSdk = 36`, `compileSdk = 36`.
- R8 full mode, code shrinking, obfuscation, resource shrinking and optimized resource shrinking are enabled. Play Console also confirms class repackaging.
- This is a native Android/Capacitor integration with bundled web game assets, not a Unity MAS integration.
- AdMob and AppLovin remain included as required by your custom integration documentation.

## Measured results

The following scores were extracted from `BUNDLE-METADATA/com.android.tools/r8.json` in the signed AABs, not inferred from build flags or APK file size:

| Local build | Optimization | Obfuscation | Shrinking |
| --- | ---: | ---: | ---: |
| Full MAS integration, release 46 | 4.25% | 4.35% | 4.35% |
| Full integration after refining broad app-level keep rules, experiment | 16.09% | 16.33% | 16.33% |
| Three-network integration, release 47 | 38.12% | 38.35% | 38.35% |
| Selective 11-network integration, release 48 | 27.05% | 27.16% | 27.16% |
| Same current application, version 49, AGP 8.13.0 / Gradle 8.14.3 control | 27.05% | 27.16% | 27.16% |
| Same version 49, AGP 9.3.2 / Gradle 9.5.0 control | 27.02% | 27.15% | 27.14% |

We chose the 11-network configuration because we prefer to retain ad competition instead of reducing the SDK to just three networks. For the local artifacts, the AAB size decreased from 53,088,805 to 35,174,062 bytes, and total uncompressed DEX size decreased from 75,798,764 to 35,745,368 bytes between releases 46 and 48. These are local archive measurements, not runtime memory or device-specific Play download sizes.

We also completed a controlled build of the same version-49 source with AGP 9.3.2 and Gradle 9.5.0, keeping R8 9.4.14 and all 11 networks unchanged. Both builds succeeded. The AAB decreased from 35,183,682 to 35,035,744 bytes (0.42%), and uncompressed DEX decreased from 35,745,368 to 35,530,316 bytes (0.60%). Resolved MAS dependency reports match exactly; all 98 asset/native-library entries match by SHA-256. However, the R8 coverage scores did not improve, as shown above. Updating AGP/Gradle alone therefore did not resolve the coverage issue in this configuration. Device validation of the new build is still pending.

## Findings from the R8 Configuration Analyzer

The analyzer attributes particularly broad restrictions to these concrete SDK/adapter versions:

1. `com.unity3d.ads-mediation:mintegral-adapter:5.6.0`: a support-library wildcard keep rule is expanded by Jetifier to AndroidX, preventing optimization well beyond the adapter itself. We disabled only the Mintegral-to-ironSource route. Mintegral remains available through AdMob and AppLovin, and ironSource itself remains included.
2. `io.bidmachine:ads:3.3.0` and companion modules: keep rules retain a large graph of SDK and embedded dependency code.
3. TopOn integration and its SmartDigi/HyperBid companion modules: extensive keep rules retain significant code.
4. `com.vungle:vungle-ads:7.6.3` and adapters: broad Google Play Services keep rules restrict optimization outside Vungle's own implementation.

In the full-integration analyzer report, rules attributed to Mintegral/adapters affected 175,181 live non-resource items; BidMachine 115,444; TopOn 103,186; and Vungle 100,878. Items are classes, fields and methods, not bytes. Counts overlap and must not be added together; these are not per-network optimization percentages or measured marginal savings from independently removing each SDK.

We currently retain AdMob, AppLovin, Bigo, Meta Audience Network, DT Exchange, InMobi, ironSource, Mintegral, Moloco, Pangle and Unity Ads. We exclude BidMachine, TopOn, Vungle and the single Mintegral-to-ironSource route.

We have not rewritten vendor consumer keep rules inside the SDKs. Our app-level MAS keep rule excludes generated `R`/`R$*` resource tables while preserving MAS classes and adapter entry points. We do not add global `-ignorewarnings`, `-dontoptimize`, `-dontshrink` or `-dontobfuscate` in our own configuration. However, the merged configuration includes a dependency-supplied `-ignorewarnings`; our baseline build consequently reports missing-class warnings in SDK code without failing. Remaining consumer rules still account for most restrictions in the selective build.

The global `-ignorewarnings` originates from the `pag-sdk-ad-unfat-7909-20260204213520-release` artifact in the Pangle dependency chain. The baseline reports missing Google BillingClient classes referenced by `com.tiktok.iap.billing.client.V5_V8BillingProxy`, `com.bytedance.sdk.openadsdk.core.model.NetExtParams$RenderType`, `com.bytedance.sdk.openadsdk.core.settings.TTSdkSettings$FETCH_REQUEST_SOURCE`, and `com.facebook.infer.annotation.Nullsafe` / `Nullsafe$Mode`. We have not added a billing SDK or blanket suppression to hide these warnings; the game currently uses rewarded ads, not in-app purchases.

## Questions for your team

1. Do you have a supported, narrower R8/ProGuard configuration for MAS 4.18.1, especially for a rewarded-only native Android integration? Which rules in your published configuration are still necessary with current SDK consumer rules?
2. Can you confirm the broad Mintegral/ironSource AndroidX keep rule and provide an updated adapter, or a vendor-approved workaround that does not compromise reflection, initialization or reward callbacks?
3. Are fixes or SDK updates planned for these broad rules? Is there an upcoming MAS release or supported patch with improved R8 coverage?
4. Which newer underlying ad-network SDK/adapter versions, if any, are officially compatible with MAS 4.18.1? We do not want to force unsupported versions through Gradle dependency resolution.
5. Is there a recommended rewarded-only dependency configuration that removes unused ad formats and auxiliary components while retaining the supported networks? Are any currently included quality-control components optional through an officially supported configuration?
6. What compatibility guidance do you have for AGP 9.3.x, Gradle 9.5.x and recent standalone R8 versions? Is there a recommended tested combination?
7. Could you review our selective configuration and advise whether the disabled networks/routes can safely be restored after updated rules or adapters become available?
8. What is the supported treatment of the missing classes listed above, particularly the optional purchase-tracking code in a rewarded-only app? Can the dependency-level global `-ignorewarnings` be removed and replaced with correct dependencies or narrowly scoped, documented optional-reference handling?

We can provide the dependency list, sanitized analyzer findings, R8 metadata and a minimal reproduction of the problematic rules. Please let us know which materials would be most useful and how to share them securely. We will not include signing keys, passwords or production user data.

Relevant references:

- Google Play technical quality requirements: https://support.google.com/googleplay/android-developer/answer/17492799
- Android R8 Configuration Analyzer: https://developer.android.com/topic/performance/app-optimization/r8-configuration-analyzer
- Yodo1 ProGuard configuration: https://developers.yodo1.com/docs/sdk/advanced/proguard/
- Yodo1 Android custom integration: https://developers.yodo1.com/docs/sdk/guides/android/integration/

Thank you for your help. We would prefer a vendor-supported solution that improves optimization without sacrificing rewarded-ad reliability or unnecessarily reducing network coverage.

Best regards,
Alexey
MiddleFrame / Tic Tac Toe Plus
kenor.brook@gmail.com
