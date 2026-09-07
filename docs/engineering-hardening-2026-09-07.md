# Контрольный рефакторинг и инженерные ограничения

Дата: 2026-09-07. Основание: [независимый аудит](technical-architecture-android-audit.md). Исходный commit этого этапа: `f4f7cdb10676ca052e9d16e94fa7ce5d7d586441`; исходный Android AAB — финальная сборка аудита с SHA-256 `bd32a43d4e1a17bf3523901e0e26aa7360c549a10a56f0cbae6febc7580a3e4f`.

## Результат

Внедрены исправления надёжности, ограниченный рефакторинг по ответственности и повторяемые проверки. На ответ Yodo1 работа не опиралась. Механика, экономика, SQL schema, публичные JSON API, версии SDK, 11 рекламных сетей, отключённый маршрут и Android-подпись сохранены. Владелец отдельно выбрал WebView 111+ с локальным экраном обновления; min SDK 25 сохранён.

Главные изменения:

1. Аккаунт и очередь защищены от старого initialization snapshot, поздних ответов и переключения во время rewarded attempt. Восстановление Google выполняется явно; pending операции нужного аккаунта отправляются до обновления UI.
2. Лимит rewarded, wallet и ledger изменяются атомарно в D1 batch; две параллельные выдачи не занимают последний слот одновременно. Размер запроса допускает максимальную валидную библиотеку из 100 колод.
3. Photon проверяет отправителя, роль, комнату и структуру сообщения; отмена connect действительно инвалидирует будущие callbacks. Отдельно исправлено принятие SDK cleanup за уход соперника.
4. Таймеры и анимации получили явного владельца cleanup; исключены накопление завершённых timeout handles и перезапуск transfer из-за нового массива props. Локальный snapshot записывается один раз вместо пяти mirror writes.
5. AGENTS.md, архитектурный AST gate, единый `quality`, GitHub CI, WebView policy и Android release budgets делают эти требования повторяемыми. Проценты R8 не подменяют измерение скорости, памяти или стабильности.

## Выполненные изменения и доказательства

| Аудит / риск | Реализация | Проверка и практический предел |
|---|---|---|
| B1, P1: повторная синхронизация возвращала баланс 220 вместо 170 | `app/game/player-progress-client.ts:129`: promise кэшируется только пока выполняется; session generation проверяется после token/fetch/body boundaries | `tests/progress-client-lifecycle.test.mjs`: последовательные refresh, inflight dedup, A→B→reconnect, поздние успешные и ошибочные ответы |
| B1/B7, P1: истёкшая сессия могла стереть старую очередь | `player-progress-client.ts:117`, `app/components/game/hooks/useCloudAccount.ts:111`: известный аккаунт не заменяется гостем автоматически; явный native Google recovery сохраняет cache | Cold expiry, queue-empty expiry, same-account restore+drain, выбор B при pending A и последующий возврат A. Backend может уже выдать B token, но A cache/queue не применяются к B |
| B2, P1/P2: все ошибки выглядели как offline и бесконечно блокировали FIFO | `app/game/progress-request-error.ts:1`, `app/game/request-timeout.ts:1`, `useCloudAccount.ts:30`: typed errors, deadline, backoff+jitter, Retry-After, отдельный conflict/auth state | `tests/cloud-lifecycle.test.mjs`, `tests/progress-reliability.test.mjs`: 400/401/429/503, сохранение queue, поздний ack, retry cleanup. Неудачный ручной retry не снимает блокировку конфликта. Автоматического rebase пока нет |
| B7, P2: покупка во время входа / ad A после перехода на B | `app/game/account-operation-gate.ts:1`, `app/components/game/hooks/usePlayerCollection.ts:144`, `useRewardedAd.ts:70`: barrier до await, попытка завершается однократно; UI cleanup не отменяет earned completion | Двойной show, unmount до earned, отсутствие React writes после unmount в hook показа рекламы, запрет switch во время attempt. Смерть процесса/постоянное хранение receipt остаются отдельной задачей |
| B3, P2: раздельная запись очереди/снимка | `app/game/local-progress-commit.ts:5`, `app/game/local-player-progress.ts:118`: общий commit-port с откатом queue при синхронном отказе snapshot; UI обновляется после записи | Injected storage failure сохраняет прежний snapshot и прежнюю очередь. Удалены четыре legacy mirror writes; legacy-only saves всё ещё читаются. Это **не** crash-safe транзакция нескольких keys |
| B4, P2: обход лимита и неверный ledger balance | `app/backend/rewarded-rewards.ts:23`, `app/api/rewards/ad/route.ts`: conditional insert + wallet update + receipt check в одной batch; Retry-After и CORS expose | `tests/backend-rewards.test.mjs`: 19+2 → один успех, burst 30 → 20, восемь concurrent одинаковых ID → одна выдача, SQL rollback, пересечение с purchase, чужой receipt. Лимит остаётся **20 × 50 за скользящий час** |
| B5, P2: корректная библиотека не помещалась в запрос | `app/backend/progression-input.ts:3`, `app/api/progression/route.ts`: bounded parser, 128 × 1024 UTF-16 code units | `tests/progression-input.test.mjs`: 100 колод ×16 карт, максимальные escaped ID/name, 82 990 characters; parser + реальное SQLite-сохранение. Сохранена прежняя length-семантика, это не streaming byte limit |
| N1, P1: host принимал чужой state | `app/game/network-message.ts:60`, `app/game/photon.ts:237`: исчерпывающие поля, границы, sender/role/current-room | `tests/network-message.test.mjs`, `tests/photon-session.test.mjs`: malformed/deep fields, неправильный sender и role; обычные игровые состояния принимаются. Host всё ещё доверенный peer, не authoritative server |
| N2, P1: disconnect не отменял import/callback | `app/game/photon.ts:272`, `app/components/game/hooks/usePhotonGame.ts`: generation, detach, failed startup cleanup | Connect→disconnect→import completion, stale callback, error/disconnect retry, SDK cleanup=true, конкретный opponentActorNr. Real Photon service не использовался |
| F1/F3, P2: рост retained handles / повтор анимации | `app/game/animation-sequence.ts:1`, `useMatchmakingAnimation.ts`, `CardDeckTransfer.tsx`, `CardPurchaseFlow.tsx:43` | `tests/animation-lifecycle.test.mjs`: тысячи виртуальных callbacks без накопления завершённых timers, отмена wait/frame/animation, стабильные inputs. Не измерение Android PSS/FPS |
| A1, P1: floor 60 при target 111 | `build/android-webview-policy.ts:1`, `build/android-compatibility-plugin.ts`, `capacitor.config.ts`, `android-client/webview-update.html` | `tests/android-compatibility.test.mjs`: floor, unsupported/unknown UA, delayed module boot. Локальная RU/EN fallback-page без сети и плагинов; min SDK 25 прежний |
| A2/A3, P2: native callbacks и init failure | `android/app/src/main/java/com/MiddleFrame/Tictactoe/RewardedAdsPlugin.java:280`, `RewardedAdCallbacks.java`, `AdInitializationState.java`, `PendingRequest.java` | Weak callback target, main-thread dispatch, уничтожение pending calls, generation, retry 5→60 секунд, pause/resume. Existing Earned/Closed contract и consent values не изменялись; порядок callback в реальной mediation требует device test |
| A3, Android lint | `GoogleAuthPlugin.java:74`, `CredentialErrors.java:10`, SDK-location writer | Убран RestrictedApi `GetCredentialException.getType()`; публичные exception classes и identity-safe cancel. Точечно исправлен `sdk.dir` с сохранением остальных байтов и backup в ignored work |

Контрольный рефакторинг отделил `useCloudAccount` от коллекции, commit-port от progression UI, rewarded transaction от общего backend progress, сетевой validator от Photon lifecycle, native pending request/initialization state от plugin glue. Крупные GameClient и PassScreen не разбивались ради числа строк. Их следующие границы привязаны к authoritative controller и версиям пропусков, а не к косметическому перемещению JSX.

## Измерения и проверки

Baseline перед изменениями: **126/126 tests PASS**. Существующий audit baseline также содержал успешные JS lint/production/typecheck и штатный Android release; полный Android lint имел 3 errors /20 warnings. Чужие изменения GAME_DESIGN.md и сопутствующей документации были уже в рабочем дереве и не включаются в этот этап.

Финальный `pnpm run quality` прошёл: **213/213 тестов**, TypeScript, ESLint, production Web/Worker build, Android web build и бюджет web assets. Runtime import graph: **138 source files**, 303 internal runtime edges, 101 internal type edges, **0 runtime cycles**. Единственный цикл, учитывающий только типовые ссылки между engine/card-effects/turn-effects, разрешён как erased types.

В Android web output 53 файла, **1 167 718 bytes**, из них JavaScript **445 332 bytes**. Старый baseline AAB public assets включает ещё файлы Capacitor, поэтому сравнение raw `android-shell` и packaged AAB проводится отдельно. Шесть Vite warnings о game font/image references проверены: все указанные файлы существуют после штатного asset-copy plugin; это не пропавшие release assets. Browser/device rendering не проверялся и не объявляется проверенным.

| Android метрика | Baseline до этапа | После этапа |
|---|---:|---:|
| AAB bytes | 35 039 520 | 35 057 804 (+18 284; +0,052%) |
| Все DEX bytes | 40 548 224 | 40 556 968 (+8 744; +0,022%) |
| Class definitions | 42 208 | 42 217 (+9) |
| Method definitions | 242 732 | 242 773 (+41) |
| Method-ID slots | 272 189 | 272 211 (+22) |
| Native count /bytes | 20 /3 460 752 | 20 /3 460 752; все hashes прежние |
| R8 optimization /obfuscation /shrinking % | 27.02 /27.15 /27.14 | 27.03 /27.16 /27.15 |
| Full Android lint errors /warnings | 3 /20 | 1 /19; raw FAIL |

`bundleRelease assembleRelease testDebugUnitTest testReleasePolicy testOptimizationVerification` завершились успешно за 356,77 секунды; 6 native unit tests прошли. Независимый ZIP/DEX scanner подтвердил размеры и counts. R8 обрабатывает четыре DEX (35 539 060 bytes, 219 042 method definitions); пятый DEX внутри assets Meta (5 017 908 bytes) побайтово прежний. Все 20 native entries тоже побайтово прежние. Прирост относится к коду проверок, восстановления и совместимости; уменьшение размера не получено.

`bundletool validate`, подписи AAB/APK, соответствие APK certificate pin, APK `zipalign -P 16`, bundle `PAGE_ALIGNMENT_16K` и ELF segment checks прошли. SHA-256 нового AAB: `d42693e27a161962fe8063899cde271edeb36e8002bbebd5cca19d3d3ed4d2cb`. Свежий полный `lintRelease --rerun-tasks` завершился **FAIL: 1 error /19 warnings**; regression gate отдельно дал **PASS, reportFresh=true, no-new-errors**. Единственная ошибка — известный Picasso `NotificationPermission`; исключение истекает 2026-10-07. Ошибки RestrictedApi и PropertyEscape устранены.

Логи и промежуточные артефакты: ignored `work/technical-audit-2026-09-07/refactor-*` и `work/android-hardening-2026-09-07`. [Обезличенный JSON измерений](audit-support/android-hardening-measurements.json) сохраняет итог и команды проверки. Коммит содержит правила, исходники и тесты; Android binaries, реальные аккаунты и приватные настройки не публикуются.

Сборка не доказывает улучшение cold start, CPU, WebView PSS, батареи или FPS. Их новый runtime baseline не снимался. Матрица исключения сетей не повторялась: production profile/SDK не менялись, и проверяемое изменение находится в app-owned коде. Число R8 keep restrictions не использовалось как marginal cost и не связывалось с ранжированием.

## Правила и автоматизация для последующих изменений

- [AGENTS.md](../AGENTS.md) задаёт обязательную дисциплину для агента: конкретный воспроизводимый дефект, узкие владельцы ответственности, trust/ownership, cleanup, migration, доказательства и запрет обхода gates.
- [engineering-standards.md](engineering-standards.md) содержит карту модулей, правила добавления карт/режимов/ranked/сезонов/колод/entitlements, Android release/device протокол и шаблон задания.
- [architecture-policy.json](../engineering/architecture-policy.json) + [check-architecture.mjs](../scripts/check-architecture.mjs) контролируют runtime boundaries и классификацию новых игровых файлов. Синтетические тесты проверяют, что нарушающие границы fixtures действительно отклоняются.
- [quality workflow](../.github/workflows/quality.yml) запускает `npm ci` и единый `quality` на push main/PR. Read-only permissions, pinned action commits, Node 24.19.0; Android signing/публикации в CI нет.
- [release-policy.json](../android-config/release-policy.json) задаёт toolchain/profile и review budgets. Они проверяются в `bundleRelease`. [check-android-web-budget.mjs](../scripts/check-android-web-budget.mjs) ловит web growth в дешёвом CI до Gradle.
- [lint-known-issues.json](../android-config/lint-known-issues.json) допускает ровно существующую notification path Picasso до 2026-10-07. [check-android-lint.mjs](../scripts/check-android-lint.mjs) отклоняет старый/неполный report, новый error, дубликат или истёкшую запись. Он **не меняет** raw full-lint FAIL на PASS.

Повторять полный дорогой аудит на каждый build не требуется. Бюджет/граница, смена mediation stack, trusted multiplayer, экономика или persistence migration являются поводами для целевого пересмотра. Нельзя гарантировать, что будущая разработка никогда не потребует рефакторинга; теперь известные классы ошибок проверяются регулярно.

## Остаточный backlog и следующий шаг

| Когда | Следующее действие | Почему не внесено в этот этап |
|---|---|---|
| Следующий технический этап | Versioned account-scoped durable snapshot+queue и receipt payload binding, с migration/replay/rebase fixtures | Требует изменения формата данных, запрещённого исходными ограничениями. Текущий exception rollback и live account barrier не заменяют crash-safe storage |
| До authoritative multiplayer | Детерминированный RNG/ruleset, headless phase scheduler, command IDs/revisions, out-of-order/replay, отдельная колода каждого игрока | Изменяет trusted protocol и поведение матчей; нужен отдельный миграционный шаг |
| До коммерческого релиза | Verifier для paid entitlement/round proof/reward attempts; версия seasons/pass/economy; multi-device library conflict | Нынешние test premium, client record-round и legacy receipts остаются прототипными |
| До следующего Android релиза | Реальное device profiling и rewarded/account recovery smoke; решение по vendor Picasso lint и официальным MAS rules | Unit/VM/release build не проверяют устройство или vendor callback ordering. Ответ Yodo1 полезен, но app-owned работа его не ждёт |

Для уже выполненной работы дополнительных действий владельца не требуется. Порог WebView согласован. Для следующей миграции нужно расширить разрешённую область изменения формата данных; для установки тестовой сборки на личный телефон — отдельное разрешение. Игру на телефоне не устанавливали, приложение/данные не удаляли; APK/AAB и Google Play не публиковали.
