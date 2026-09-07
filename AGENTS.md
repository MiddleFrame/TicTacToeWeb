# Web Project Rules

- Treat this repository as the authoritative standalone version of Tic Tac Toe Plus.
- Do not read from, compare with, or modify the former Unity project.
- Keep domain logic, state, UI, animation, audio, networking, platform integration, and assets in focused modules.
- Keep methods short and avoid duplicated behavior across game modes.
- Do not add comments to source code.
- Run tests, lint, and the production build after changes.
- Publish successful changes automatically unless the user explicitly asks to keep them local.
- Keep Android signing secrets and keystores under `android-config/private`, which must remain ignored by Git.

## Start and scope

- Read `docs/engineering-standards.md` before implementation. Read the relevant product/infrastructure documentation for the surface being changed; use `docs/technical-architecture-android-audit.md` as a dated baseline, not current runtime state.
- Inspect Git status first. Preserve unrelated work and stage only the files owned by the current task.
- Make the smallest complete change that fixes the observed behavior. Separate refactoring from changes to rules, economy, contracts, persistence formats, SDK sets, and signing.
- Reproduce a reliability bug with executable behavior before fixing it. Source-text assertions may check packaging/wiring; they are not sufficient evidence for state, network, concurrency, or lifecycle behavior.
- Do not create a second implementation of a rule for a new mode. Extend the existing domain policy/registry and adapters. Extract responsibilities when a change would otherwise copy decisions across modes; do not split files solely to meet a line-count limit.

## Module boundaries

- Keep pure rules in the modules classified as `pure` in `engineering/architecture-policy.json`. No runtime React, DOM, storage, platform SDK, network, or backend dependency there.
- Classify each new `app/game` module as pure or adapter, with its actual responsibility. Run `npm run check:architecture`; never hide a runtime cycle with an exemption.
- Components render state and dispatch intentions. Hooks own subscriptions and UI lifecycle. Adapters own transport/storage/platform effects. Backend handlers authenticate and validate, then call domain policies and transactional persistence.
- Shared validators are reused on both sides, but server authentication, ownership, limits, and command validation remain mandatory. Client validation does not establish trust.
- Expose narrow view/command ports to screens. Do not expand a composition root into storage, request, economy, and animation implementation.

## Account, persistence, and concurrency

- Every asynchronous operation must have an owner and a stale-result policy: account/session, match/room, request generation, or mounted component. Validate ownership after every asynchronous boundary before applying state or acknowledging a queue entry.
- Account switching is an exclusive transition. Drain pending operations before switching when the old session is valid; use the explicit recovery flow when it is not. Do not clear an old account's queue to make login succeed.
- Rewarded attempts hold the account transition barrier until completion. Component unmount removes UI subscriptions but does not transfer or discard an earned reward. Completion must be idempotent.
- Keep operation IDs stable across retries. Preserve pending commands until an acknowledgement from the correct account. Distinguish network/5xx/busy, quota, expired authentication, and permanent conflict; respect `Retry-After` and cancel retry timers on teardown.
- Do not silently discard or reorder rejected economic commands. Later commands may depend on their balance or entitlements. Add explicit reconciliation with a reviewed persistence migration when required.
- Persist a local operation before exposing its successful result. Do not describe multi-key localStorage writes or rollback-on-exception as a crash-safe transaction. Do not add more legacy mirror writes.
- Validate concurrent ledger/quota/idempotency changes using the real SQL and an SQLite transaction fixture, including replay and rollback. A pre-transaction read cannot reserve a quota slot or establish the final ledger balance.
- A schema or receipt-format change requires a versioned migration, old-data fixtures, interrupted/retry cases, and an explicit rollback/recovery plan. Never expire idempotency receipts without a replay policy.

## Matches, effects, and performance

- Treat Photon payloads as untrusted: validate sender, role, room, schema, and bounds. Keep the runtime validator exhaustive for the wire state. Peer-host validation does not make a match authoritative or suitable for ranked rewards.
- Async connect/import callbacks must check a generation; teardown detaches handlers and invalidates pending startup. SDK cleanup events must not award a win.
- Before ranked/authoritative work, add versioned commands, deterministic RNG/state transitions, and a headless match scheduler. Animation completion must not become a new source of trusted game results.
- Every timer, animation frame, Web Animation, audio source, and listener has one teardown owner. Completed timer handles must leave their collection. Use stable animation inputs; render updates must not restart a running purchase reveal.
- Do not claim FPS, startup, heap, CPU, or battery improvements from code shape, bundle size, or R8 coverage. Measure each separately. See the device protocol in `docs/engineering-standards.md`.
- New cards, seasons, decks, currencies, or cosmetics need the extension checks in that document. Do not invent parallel booleans or duplicate reward paths across screens.

## Android and dependency changes

- Preserve the approved SDK/network/toolchain profile in `android-config/release-policy.json`. Update a dependency through its supported vendor compatibility set and the repository lockfile; never force a transitive SDK version to silence a conflict.
- Do not edit vendor AAR consumer rules or add global `-ignorewarnings`, `-dontoptimize`, `-dontshrink`, or `-dontobfuscate`. Existing vendor restrictions are evidence, not permission to add app-level workarounds.
- AAB checks must include all DEX entries, including asset DEX, native ABI/ELF alignment, bundled web assets, R8 metadata, and the current network profile. Do not infer marginal SDK cost from overlapping keep-rule counts.
- Keep the WebView floor, Vite target, and local fallback tied to `build/android-webview-policy.ts`. New web APIs need compatibility evidence or a tested fallback at that floor.
- Do not widen artifact budgets, refresh a lint exception, or change a policy baseline merely to turn a failed gate green. Document the measured cause, supported compatibility, and accepted tradeoff.
- Run controlled SDK-removal experiments only for a dependency/profile change or a measured regression. Use ignored temporary profiles, the same source/toolchain, and no production network exclusions from an experiment.
- Never inspect or publish private configuration, signing material, tokens, or player data. Do not install, uninstall, or clear app data on a connected device without the owner's separate authorization. Read-only ADB checks are allowed.

## Completion

- Run `npm run quality` (or `pnpm run quality` with existing dependencies): architecture, TypeScript, tests, lint, web production build, Android web build and its asset budget.
- For Android source/toolchain/SDK changes and release candidates, also run the release protocol in `docs/engineering-standards.md`: unit tests, release policy tests, fresh bundle, artifact budget, full lint and its separate regression classification.
- Report a raw Android lint failure as a failure even when the reviewed-known-issues comparison passes. Do not substitute a debug build for a release check.
- Record changed behavior, actual checks, before/after measurements, and remaining limitations in the task's implementation report. Keep historical audit evidence dated and separate from later fixes; do not rewrite `GAME_DESIGN.md` with audit conclusions.
- Publish the validated source/web changes automatically within existing authorization. Never publish an Android build or upload to Google Play without an explicit request.
