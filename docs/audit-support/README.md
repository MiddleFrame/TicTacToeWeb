# Воспроизведение технического аудита 7 сентября 2026

Небольшие диагностические fixtures для самостоятельного TicTacToeWeb. Они читают текущие исходники и используют только синтетические аккаунты, memory storage, SQLite `:memory:`, поддельные HTTP/Photon/Capacitor и виртуальные таймеры. Сеть, устройства, production API, пользовательские базы и `android-config/private` не используются. Сборки и установка зависимостей автоматически не запускаются.

После внедрения исправлений актуальные проверки находятся в `tests/` и запускаются через `npm run quality`. Эти диагностические probes сохраняют исторические ожидания дефектов; для повторения исходного аудита использовать отдельный checkout commit `f4f7cdb10676ca052e9d16e94fa7ce5d7d586441`. Не изменять их assertions для получения зелёного результата на исправленном коде. См. [отчёт о внедрении](../engineering-hardening-2026-09-07.md).

## Запуск

Проверенная среда: Node **24.19.0**, Git и уже установленные зависимости из lockfile репозитория, включая TypeScript и drizzle-orm. Используются встроенные Node TypeScript stripping, `node:sqlite` и `module.registerHooks`; одного заявленного project minimum Node 22.13 недостаточно гарантировать эти диагностические API. Для сравнения TS-исправлений должен быть доступен Git commit `e0e8cbfcebf002ac72b667e980574d166ad5502a`.

После размещения файлов в `docs/audit-support` выполнить из корня репозитория:

```powershell
node docs/audit-support/client-sync-probe.mjs
node docs/audit-support/backend-reward-probe.mjs
node docs/audit-support/operation-replay-probe.mjs
node docs/audit-support/reward-account-probe.mjs
node docs/audit-support/frontend-probes.mjs
node docs/audit-support/dependency-probe.mjs
node docs/audit-support/ts-fix-review-probes.mjs
```

Все скрипты находят корень checkout относительно своего расположения; запуск с другим cwd тоже поддерживается. До переноса staging-файлов использовать тот же набор команд с путём `work/technical-audit-2026-09-07/repro-staging/`.

JSON-результаты одновременно печатаются в stdout и записываются только в игнорируемый каталог **`work/technical-audit-2026-09-07/repro/`**. Исходники и tracked-файлы не изменяются. Скрипты запускать отдельными Node-процессами, как в списке: некоторые устанавливают синтетические globals/module hooks для одного процесса.

## Назначение и интерпретация

| Скрипт | Что проверяет |
| --- | --- |
| `client-sync-probe.mjs` | Stale initialization snapshot, A→B account switch, блокировка очереди permanent rejection, разрыв записи queue/snapshot |
| `backend-reward-probe.mjs` | Настоящие TS/Drizzle-функции на всех миграциях SQLite: 19+2 concurrent ad grants, ledger balance, replay и число SQL statements |
| `operation-replay-probe.mjs` | Несовпадающий payload того же operation ID и максимальный валидный deck payload против серверного ограничения размера |
| `reward-account-probe.mjs` | Покупка во время Google switch, очистка неподтверждённой операции и поздний rewarded callback после смены аккаунта/unmount |
| `frontend-probes.mjs` | Fake Photon cancellation/sender/schema, внешний RNG движка, 10 000 виртуальных animation callbacks |
| `dependency-probe.mjs` | TypeScript AST собственных `app`, `worker`, `db`, `android-client`, `build`: import graph и SCC отдельно от type-only зависимостей |
| `ts-fix-review-probes.mjs` | Три точечных TS-изменения против **фиксированного baseline commit**, 10 005 сравнений выбора клетки, DOM cleanup; при наличии Android web artifact — синтаксис главного JS |

Backend и account lifecycle probes намеренно утверждают **воспроизведение известных дефектов**, поэтому exit 0 означает, что зафиксированный сценарий повторился. После исправления соответствующего дефекта эти assertions должны перестать проходить; их следует перенести в regression tests с новым ожидаемым поведением. Frontend/dependency probes печатают диагностику; TS review проверяет сохранение поведения безопасных исправлений.

TS review читает `android-shell/assets/index-*.js`, только если найден ровно один существующий такой файл. Иначе bundle analysis явно помечается `skipped`, а проверки TS-правок продолжаются. При необходимости этот отдельный artifact заранее готовится штатной командой `pnpm run android:web`; fixture сам её не запускает. Анализ уже имеющегося bundle не подтверждает, что он соответствует текущему checkout.

SQLite statement counts не являются D1 latency или billed rows. Виртуальные таймеры не измеряют heap/PSS/FPS. Synthetic ad requests не подтверждают callbacks реального SDK. Числа графа и JSON payload относятся к текущим исходникам и закономерно изменятся при развитии проекта.

Отдельный [Android CLI и порядок контролируемой матрицы](README-android.md) воспроизводят измерения AAB, DEX и ELF на Python без внешних зависимостей. Экспериментальные профили и большие артефакты остаются в ignored work.
