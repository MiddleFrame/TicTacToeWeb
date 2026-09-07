# Заключительный проход оптимизации

Дата: 2026-09-07. Исходный commit: `2575af20548ed32cc78160d3909efa242bff90f0`. Продолжение [аудита](technical-architecture-android-audit.md) и [контрольного рефакторинга](engineering-hardening-2026-09-07.md). Проверяется текущий standalone-проект; сторонние незакоммиченные документы сохранены.

## Результат и граница завершения

Цель этапа — закончить безопасную локальную оптимизацию текущего профиля, сохранив механику, экономику, публичные API, сохранения, рекламные сети, SDK и подпись. Выполнены два изменения поведения и автоматическая защита полученного результата. Файлы изображений, шрифтов и аудио не перекодировались с потерей качества.

1. Магазин, коллекция, настройки и пропуск загружаются при открытии, вместо включения в стартовый JavaScript. Меню и игровой экран остаются доступны без отдельной загрузки их кода.
2. Движение карты объединяется в одно обновление за кадр. Отпускание обрабатывается сразу по конечным координатам; правило выбора клетки и исход игры не менялись.
3. Бюджет стартового JavaScript учитывает транзитивные статические imports/re-exports, исключает динамические chunks и предотвращает незаметный возврат к большому стартовому файлу.

Это завершение текущего локального прохода, а не обещание отсутствия любой будущей регрессии. Новая механика, зависимость или нарушение бюджетов запускают целевую проверку. Изменения схемы сохранений и authoritative multiplayer остаются самостоятельными архитектурными задачами.

## Измерения до и после

Одинаковые Node 24.19.0, lockfile, Vite, Android toolchain и production-профиль. Baseline: 213 tests PASS до правок. Baseline AAB SHA-256: `d42693e27a161962fe8063899cde271edeb36e8002bbebd5cca19d3d3ed4d2cb`.

| Метрика | До | После | Интерпретация |
|---|---:|---:|---|
| Стартовый JavaScript, bytes | 359 090 | 323 068 | −36 022; −10,03% кода для начальной загрузки |
| Весь JavaScript, bytes | 445 332 | 448 666 | +3 334; цена chunks, fallback и планировщика |
| Все Android web assets, bytes | 1 167 718 | 1 171 053 | +3 335; это не уменьшение общего пакета |
| JS вторичных экранов загружается при открытии меню | Да | Нет | SSR-тест с настоящими React.lazy/Suspense и счётчиком module factories |
| 100 pointermove до одного кадра: hit-tests / state writes | 100 /100 | 1 /1 | Детерминированный burst; не измерение FPS |
| 240 pointermove за 60 кадров: hit-tests / state writes | 240 /240 | 60 /60 | −75% операций в этом сценарии; последний sample сохранён |
| 100 движений над картой без начала drag: hit-tests / state writes | 100 /100 | 0 /0 | Убрана работа при простом hover |

Для secondary chunks на вебе появляется запрос при первом открытии; повторное открытие использует загруженный модуль. Android получает все chunks внутри APK и не загружает их с сервера. Отложена также отдельная CSS-часть настроек. Основной stylesheet остаётся общим; дополнительное дробление мелких ресурсов без device/network trace не вносилось.

Новый максимум `initialJavaScriptBytes=340000` оставляет около 5,2% запаса от нового результата и меньше прежнего baseline. Это новый измеренный guard; прежние AAB/DEX/native/web budgets не увеличены. Счётчик включает все статически импортируемые модули ровно один раз, так что перенос кода в ещё один eager chunk не обходит ограничение. Бюджет стартового JS исполняется в `quality`, общий web budget — также в Android release gate.

## Код и доказательства

| Файл | Изменение и проверка |
|---|---|
| `app/components/game/GameNavigation.tsx:11` | Четыре module-scope React.lazy. `tests/deferred-screens.test.mjs`: меню не импортирует дополнительные экраны, каждый экран загружается по требованию, повторное открытие не вызывает module factory заново |
| `app/components/game/DeferredScreen.tsx:30` | Локализованное ожидание с выходом в меню; error boundary с возвратом и явным обновлением игры. Тестирует публичное состояние нашего boundary; это не интеграционный browser-тест ошибки сети |
| `app/components/game/hooks/useCardDrag.ts:120` | Последний pointer sample вместо обработки каждого события; отмена RAF, запрет работы без активного drag, повторный pointer-up не играет карту дважды. `tests/card-drag-performance.test.mjs`: burst, поток из 60 кадров, отпускание до RAF, cancel/clear/unmount, поздняя отмена предыдущей карты |
| `scripts/lib/android-web-measurements.mjs:5` | Обход реального build output и TypeScript AST статических imports/re-exports. `tests/android-web-measurements.test.mjs`: shared module не считается дважды, dynamic chunk исключён, пропавшая/внешняя/выходящая за корень зависимость отклоняется |
| `scripts/check-android-web-budget.mjs`, `android-config/release-policy.json` | Начальный граф и общий web size проверяются единым `quality`; прежние бюджеты не повышены |

Baseline тест перетаскивания сначала упал на 100 фактических hit-tests вместо одного и на 100 hit-tests вместо нуля без начала drag. После исправления проходит тот же сценарий. VM/hook counters описывают число вызовов кода, а не количество фактических React commits или физический FPS устройства.

## Picasso: разобранная причина и решение

В merged rules четыре независимых источника сохраняют `com.squareup.picasso.**` целиком:

| Координата источника | Строка baseline `configuration.txt` |
|---|---:|
| `com.google.ads.mediation:inmobi:11.1.0.1` | 547 |
| `com.applovin.mediation:inmobi-adapter:11.1.1.0` | 588 |
| `com.inmobi.monetization:inmobi-ads-kotlin:11.1.1` | 617 |
| `com.unity3d.ads-mediation:inmobi-adapter:5.4.0` | 2597 |

По [официальной документации R8](https://developer.android.com/topic/performance/app-optimization/keep-rules-overview), keep rules объединяются аддитивно. Добавить более узкое app-owned правило и тем самым отменить эти четыре ограничения нельзя. [Документация InMobi](https://support.inmobi.com/monetize/sdk-documentation/android-guidelines/overview-android-guidelines) описывает Picasso как загрузчик рекламных ресурсов; удаление всей библиотеки не является безопасной оптимизацией. Новая версия отдельного InMobi SDK не доказывает совместимость со всем выбранным MAS/adapter набором.

`RemoteViewsAction.NotificationAction` присутствует в mapping и seeds, а собственный Java/TypeScript-код игры не вызывает notifications API. Наличие сохранённого класса не доказывает его вызов при rewarded video. `NotificationPermission` — реальная оставшаяся ошибка статической проверки, но не зарегистрированное падение игры. Идентичный случай опубликован в [Picasso issue #2354](https://github.com/square/picasso/issues/2354).

Свежие `-whyareyoukeeping` queries для `RemoteViewsAction$NotificationAction` и `RequestCreator` оба показали keep из `com.google.ads.mediation:inmobi:11.1.0.1/proguard.txt:28:1`. Это один путь удержания; четыре независимых origins подтверждены отдельно merged configuration. Queries не добавляют keep rules и не меняют SDK.

Дополнительно просканированы constant-pool method references **60 941 класса из 295 JAR-архивов** разрешённых зависимостей release. Все три найденные ссылки на notification overloads `RequestCreator.into(...)` и конструктор `NotificationAction` принадлежат самому `com.squareup.picasso:picasso:2.8`, классу `RequestCreator`. Внешних прямых method references на эти API не найдено. Это аргумент в пользу неиспользуемой notification-ветки, **не полное доказательство недостижимости**: reflection, JNI, загружаемый код и embedded DEX этим сканированием не охвачены. Вывод не используется для удаления vendor-классов.

Диагностические scripts/queries, logs и baseline snapshot сохраняются в ignored `work/optimization-closeout-2026-09-07`; [обезличенные измерения](audit-support/optimization-closeout-measurements.json) включают counts, координаты, references и границы доказательства.

**Решение:** не добавлять ненужное разрешение уведомлений, не менять vendor AAR, не форсировать Picasso/InMobi, не удалять сеть и не скрывать ошибку глобальным suppress. Сохранено существующее точное lint-исключение до 2026-10-07; срок не продлён. Возвращаться к этой части оптимизации по новому совместимому vendor-релизу, ответу поставщика или доказанному runtime-дефекту. Локальные улучшения игры ответа Yodo1 не ждут.

## Итоговая верификация

`pnpm run quality`: **231/231 tests PASS**, architecture gate (139 source files, 0 runtime cycles), TypeScript, ESLint, Web/Worker build, Android web build и оба web budgets. Шесть прежних Vite warnings о public assets сохранены; asset-copy по-прежнему упаковывает соответствующие файлы.

Финальные `bundleRelease assembleRelease testDebugUnitTest testReleasePolicy testOptimizationVerification` прошли за **32,68 s**, с повторным использованием уже выполненного R8. Шесть native unit tests имеют статус `UP-TO-DATE`: native source не менялся после предыдущего успешного исполнения. Диагностический R8 запуск с двумя queries выполнялся заново. Его первый orchestration run завершился ошибкой отдельного exporter из-за неоднозначного выбора project artifacts; exporter ограничен внешними компонентами. Отдельно исправлено размещение нового JS budget в `webLoading`, поскольку `maximum` целиком проверяется native gate. Финальная проверка проходит без обхода gates.

| Android release | Baseline | Финальный результат |
|---|---:|---:|
| AAB bytes | 35 057 804 | 35 063 594 (+5 790; +0,0165%) |
| Все DEX bytes | 40 556 968 | 40 556 968 |
| Class /method definitions | 42 217 /242 773 | 42 217 /242 773 |
| Method-ID slots | 272 211 | 272 211 |
| Native count /bytes | 20 /3 460 752 | 20 /3 460 752 |
| R8 optimization /obfuscation /shrinking | 27.03 /27.16 /27.15% | 27.03 /27.16 /27.15% |
| Full lint errors /warnings | 1 /19 | 1 /19; **FAIL** |

Все пять DEX entries, включая asset DEX Meta, и все 20 native libraries **побайтово совпали** с baseline. SDK/toolchain/profile сохранены. Подписи AAB/APK, APK certificate pin, bundletool validation, APK ZIP 16 KiB alignment и native ELF checks прошли. SHA-256 финального AAB: `869c8b4fefdab7ccf7df90b603984862d5b64e83786b8a2b47d943ab9006841e`; APK размером 25 445 759 bytes.

Свежий `lintRelease --rerun-tasks` завершился **FAIL** с прежней единственной Picasso `NotificationPermission`. Отдельный regression gate прошёл (`reportFresh=true`, `no-new-errors`). Ошибка не скрыта, срок исключения не продлён. TTID/TTFD, CPU, PSS, battery и FPS на устройстве в этом этапе не измерялись. Снижение времени запуска на 10% из размера JS не следует.

Воспроизведение: `npm ci` → `npm run quality`; Android — команды из [android-engineering.md](android-engineering.md), затем `python docs/audit-support/measure-aab.py --aab android/app/build/outputs/bundle/release/app-release.aab --output work/closeout-aab.json`. Для исторического сравнения использовать зафиксированный baseline commit и отдельный checkout. Полная повторная матрица исключения сетей не требуется: зависимости не менялись.

## Что требуется от владельца

Исходники и веб-версия публикуются автоматически после проверок. Для завершения этого локального этапа действий владельца не требуется. Android-сборка не устанавливается и не публикуется.

Перед следующим Android-релизом требуется одна разрешённая владельцем device-сессия: cold/warm startup, PSS/CPU, drag на устройстве, первые открытия четырёх экранов, rewarded/account recovery и уход в фон. Она проверяет поведение готовой сборки; это не повод снова начинать весь аудит. Ответ Yodo1 можно принести в существующую задачу вместе с техническими вложениями без секретов.
