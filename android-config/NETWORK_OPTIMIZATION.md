# MAS network audit — 2026-09-03

## Selection

Retain AdMob, AppLovin, Bigo, Meta Audience Network, DT Exchange, InMobi, ironSource, Mintegral, Moloco, Pangle and Unity Ads: 11 of the original 14 commercial networks.

Remove BidMachine, TopOn and Vungle. Remove only the Mintegral-to-ironSource mediation route, not Mintegral itself. Its AdMob and AppLovin routes remain. All other supported routes between the retained networks and mediators remain enabled.

This selection is based on the actual R8 configuration analyzer report and resolved artifacts, not SDK download sizes or an assumption that only three networks are safe. It is a verified passing selection, not a claim that every possible subset has been tested or that these vendors always perform poorly.

## Evidence

The full integration was inspected with R8 9.4.14. Counts below are distinct live classes, fields and methods whose optimization was blocked by rules attributed to the listed SDKs/adapters in that baseline report. Generated `R` resource items are excluded. Counts overlap across rule owners and must not be added together. They are not bytes, per-SDK optimization percentages, runtime RAM measurements or measured marginal gains from removing one SDK.

| Network / integration | Blocked non-resource items | Finding and action |
| --- | ---: | --- |
| Mintegral and adapters | 175,181 | The ironSource adapter `com.unity3d.ads-mediation:mintegral-adapter:5.6.0` contains a support-library wildcard keep that Jetifier expands to AndroidX. Remove that route only. In the selective build, remaining Mintegral rules affect 42,874 items. |
| BidMachine | 115,444 | `io.bidmachine:ads:3.3.0` and companion modules retain a large code graph, including embedded dependencies. Remove the network. Another 54,924 generated resource items were associated with its rules in the baseline. |
| TopOn | 103,186 | Includes TopOn core plus SmartDigi, HyperBid and companion SDKs with extensive keep rules. Remove the network and all its mediation routes. |
| Vungle | 100,878 | `com.vungle:vungle-ads:7.6.3` and adapters include broad Google Play Services keeps, blocking optimization outside Vungle's own code. Remove the network rather than rewriting vendor rules. |
| ironSource | 48,852 | Retain the network and supported routes; the problematic Mintegral adapter is excluded separately. |

The next baseline groups were Pangle (40,748), Unity Ads (36,952), InMobi (31,510), AppLovin (21,629), DT Exchange (17,542), Bigo (17,222), Moloco (3,806) and Meta (1,386). Mandatory MAS components and common dependencies were also inspected; these are not optional advertising networks. In particular, removing the mandatory AppHarbr dependency was not used as a workaround.

Local diagnostic reports are retained under ignored `work/r8-baseline/` and `work/r8-selective-eleven/`, with `library-impact.json` summaries. Recreate the HTML report with the R8 command in [README.md](README.md); its rule origins identify the specific AAR responsible. The reported counts describe those particular dependency graphs, not a stable vendor ranking.

## Final bundle verification

| Local artifact / experiment | Optimization | Obfuscation | Shrinking |
| --- | ---: | ---: | ---: |
| Release 46, full integration | 4.25% | 4.35% | 4.35% |
| Full integration with refined broad keep rules (not released) | 16.09% | 16.33% | 16.33% |
| Release 47, three networks | 38.12% | 38.35% | 38.35% |
| Release 48, selective 11 networks | 27.05% | 27.16% | 27.16% |

These scores come from `BUNDLE-METADATA/com.android.tools/r8.json` in the actual signed AAB, after compilation. The HTML analyzer's earlier graph statistics are not used to claim compliance. The release task fails if any final score is below 25%; the current narrow margin requires rechecking every SDK update. Google Play's processed bundle is the final confirmation.

Release 48's AAB is 35,174,062 bytes, versus 53,088,805 bytes for local release 46 and 13,585,072 bytes for the three-network release 47. Its four uncompressed DEX files total 35,745,368 bytes, versus 75,798,764 in release 46. The installable APK is 25,503,296 bytes. These are local file sizes, not Play's device-specific download size or runtime memory usage. All 20 packaged native libraries pass the ELF 16 KiB segment-alignment check; the APK also passes 16 KiB ZIP alignment and signature verification with the existing release certificate.

No vendor keep rules are rewritten in the selective build. MAS entry points, reflective adapter discovery and rewarded-ad callbacks retain their existing protection. AdMob and AppLovin are included as required by Yodo1. `verifyRewardedNetworks` checks all resolved MAS module coordinates, including adapter versions, so disabled networks cannot silently return through transitive MAS dependencies. The selection can be compared locally with `-PmasNetworkProfile=<absolute-profile-json-path>`; production builds use the checked-in profile by default.

Before production rollout, use Play internal testing to check startup, sign-in and rewarded ads across available retained networks. Completion must grant one reward; dismissal must grant none. Build-time checks cannot establish ad fill, revenue, SDK reflection behavior or device-specific stability. Also review the MAS dashboard so placements do not rely exclusively on the removed networks or the disabled Mintegral/ironSource route.
