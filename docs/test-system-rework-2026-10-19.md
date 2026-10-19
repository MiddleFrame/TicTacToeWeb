# Пересмотр системы тестов

Дата: 2026-10-19. База: `c6470a2c20e2eb926a6693fc12ec7f32af7f96a3`.

Цель: проверять ошибки поведения и инфраструктурные контракты, убрать ложные доказательства через поиск слов в исходнике и сделать набор понятным для сопровождения. Игровые правила, экономика, сохранения, миграции, SDK и зависимости не менялись. Посторонние изменения документации и Android IDE оставлены вне задачи.

## Организация

Вместо плоской директории теперь шесть групп: `domain` (8 файлов), `backend` (14), `runtime` (15), `ui` (4), `platform` (7), `tooling` (5). Все 53 файла входят в общий запуск. Для каждой группы есть отдельная команда; вложенные тесты обнаруживаются без shell glob. Неизвестная группа, пустой выбранный набор и тест за пределами групп приводят к ошибке.

Общий файл engine разделён по ответственности: бой, эффекты, представление/взаимодействие, покупка, сетевые команды и рогалик. Backend projection/legacy response перенесены из UI в backend. Native wiring отделён от игровых валидаторов. Два собственных hook harness и загрузчика объединены в один; memory storage и drag fixture переиспользуются. Сериализация настоящих SQLite batch выполняется в общем адаптере вместо трёх копий в тестах.

Актуальные команды, ограничения фикстур и правила добавления проверок: [tests/README.md](../tests/README.md).

## Пересмотр полезности

| Прежняя проверка | Решение и новый сценарий |
|---|---|
| Поиск `requireAdmin`, `authenticateRequest`, `isOperationId` и имён таблиц | Реально вызываются auth и HTTP handlers: отсутствие сессии, malformed bearer, banned/expired account, forged email, запрет чтения до авторизации, недопустимый JSON, покупка только для authenticated owner. Настоящие таблицы уже проверяются SQLite с миграциями |
| Поиск Google verify/revoke/sessionToken в исходнике | Проверяются порядок verify→link→revoke, session nonce, verified subject/email, отсутствие мутаций при отказе, native-only bearer. Реальный JWT verifier дополнен неверным issuer, expiry, отсутствующим subject и неподтверждённым email |
| Поиск проверок Google subject/public code при удалении | Handler отказывает чужому public code и signed subject до выдачи ticket; существующие SQL-тесты удаления, нескольких сессий, rollback и повторного ticket сохранены |
| Поиск коллекции/классов/`position: sticky` | Реальные фильтры меняют kinds, переданные grid; inspection открывается и закрывается; save/back dispatch и busy state проверяются. Ложное утверждение о геометрии удалено |
| Поиск `canBuy` и privacy-фрагментов | Настоящий StoreScreen проверяется с offline/cloud state, балансами 49/50/250, pending transaction, выбором коллекции и состояниями рекламной кнопки/диалога |
| Поиск констант return/settled и host timer | Исполняются возврат карты по фазам, отмена старого return при новом drag, host-only round advance, отмена и stale phase |
| Поиск JS lifecycle/audio guards | Исполняются native/browser events, hidden resume, listener cleanup, блокировка нового аудио при inactive, pause существующих sources/context и teardown |
| Отсутствие произвольных старых debug-идентификаторов | Удалено; рабочие настройки проверяются через настоящие callbacks и transition state. Доменный smoke-тест debug-helper без production-потребителей также удалён |
| Равенство PNG старому reference и фиксированный старый минимум versionCode | Удалено как закрепление прошлого ресурса. Размеры всех density assets, полная PNG signature/IHDR и adaptive icon wiring остаются |
| Сравнение текущих Photon region/version с константой | Удалено как закрепление конфигурации. Реальные sender/role/schema/state/intent/lifecycle проверки сохранены |
| Одноразовый `tests/backend-http-check.mjs` | Удалён: не входил в общий запуск, выбирал существующую `.wrangler` DB и напрямую добавлял/удалял строки. Авторизация покрывается изолированными handler/SQL fixtures, а квота — Fetch-функцией настоящего Worker с реальным guard и SQLite (60 разрешённых и 5 запрещённых запросов, Retry-After, X-Forwarded-For, 503 при отказе БД) |

Сохранены исполняемые проверки всех эффектов карт, сетевого payload, аккаунтов, FIFO/retry, миграции и сохранения старых данных, transaction rollback, лимитов, replay и idempotency. Исторические отчёты оставлены с исходными путями на дату их создания.

## Проверка чувствительности

В `quality` включён `test:sensitivity`. В отдельной временной копии по одному внедряются семь ошибок: admin bypass, отсутствие ограничений покупки, сломанный фильтр, duplicate rewarded completion, wrong-account acknowledgement SQL quota off-by-one и игнорирование отказа API guard в Worker. Для каждой сначала запускается исправный baseline. Изменённый код обязан упасть в выбранном сценарии с `ERR_ASSERTION`; import failure или отсутствие сценария не засчитываются. Рабочая копия и данные игрока не изменяются, временная копия удаляется.

Все 7/7 дефектов обнаружены. Это ограниченный набор конкретных свидетелей полезности тестов, а не заявление о полном mutation/code coverage.

## Фактическая проверка

- До изменений: `pnpm test`, 258/258 успешно.
- После изменений: `pnpm run quality`, 266/266 успешно; архитектура, TypeScript, 7/7 sensitivity, lint, web production, Android web и budget успешно.
- Усиленные audio/PNG assertions отдельно проверены: 5/5 успешно. После исправления замечания ревью весь quality повторён на окончательном наборе: 266/266 и 7/7 sensitivity успешно.
- CLI forwarding проверен через `node scripts/run-tests.mjs --test-name-pattern="test discovery includes"`; discovery проверяется также отдельной фикстурой с вложенными, неизвестными и пустыми группами.
- `git diff --cached --check`: успешно.
- Android web assets: 1 196 644 bytes; initial JS: 256 501 bytes. Значения совпадают с базой, production runtime не изменён. Скорость игры, UI или запуска не измерялась.

## Ограничения

Новые пакеты и другой test framework не вводились: существующие Node test runner, TypeScript transpilation, React SSR и SQLite достаточны для проверенных границ. Hook harness с явными render/commit не является React DOM/StrictMode. Проверки элементов/SSR не доказывают CSS и отсутствие scroll; для них документирован отдельный браузерный проход, но он не автоматизирован этим изменением.

Native проверки текста остаются проверками деклараций и упаковки, не доказательством работы Keystore, Credential Manager, Yodo1, реальной сети или устройства. Native source/toolchain не менялись, Gradle release/device проверки не запускались. Сетевой end-to-end HTTP через запущенный Cloudflare/Vinext server не запускался; Fetch-функция Worker исполняется с настоящим guard и SQLite. Наличие 266 зелёных сценариев не означает отсутствие других ошибок.

Независимое ревью нашло потерю проверки подключения API rate limit при удалении старого HTTP-скрипта. Добавлены два Worker-сценария и седьмая мутация, которая убирает возврат отказа из Worker. Повторное независимое ревью подтвердило исправление; новых существенных замечаний нет. Ревьюер самостоятельно выполнил полный промежуточный набор 264/264 и новые Worker-сценарии 2/2, проверил staged diff. Итоговый полный quality выполнен основным агентом после исправления.
