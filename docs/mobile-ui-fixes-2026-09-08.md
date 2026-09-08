# Мобильный интерфейс: быстрые нажатия и панель магазина

**Уточнение после проверки телефона:** увеличение воспроизведено на установленной версии 50 и вызвано растягиванием CSS grid при доборе пятой карты. Защита от zoom в первоначальном кандидате 51 эту причину не исправляет. Актуальный результат и пересобранная по просьбе владельца версия 51 описаны в [hand-layout-reproduction-2026-09-08.md](hand-layout-reproduction-2026-09-08.md). Ниже сохранены первоначальные измерения и ограничения первой сборки 51.

Дата: 2026-09-08. Baseline: `2c1a9af8cff7538a92ae79a41584cdc85981eab5`, Android versionCode 50 / 0.7.9. Владелец подтвердил обновление и игру с ботом; прежнее падение Room при старте после обновления не воспроизводилось. Эта работа не меняет выводы исторического Android-аудита.

## Наблюдения и изменения

Владелец сообщил об увеличении интерфейса при частом нажатии «Конец хода» и уточнил, что увеличивалась только игра. Read-only диагностика Android показала системную magnification configuration `activated=false`, `scale=1.0` на момент проверки; это не доказывает состояние системы в момент первоначального события.

В обеих точках входа уже были viewport `maximum-scale=1`, `user-scalable=no`; на корневом элементе — `touch-action: manipulation`. Capacitor 8.5.0 выключает built-in zoom controls, но не вызывает `WebSettings.setSupportZoom(false)`. По [Android WebSettings](https://developer.android.com/reference/android/webkit/WebSettings#setSupportZoom(boolean)) этот отдельный API управляет поддержкой жестового масштабирования.

- `android/app/src/main/java/com/MiddleFrame/Tictactoe/MainActivity.java`: после создания Bridge явно выключена поддержка zoom у игрового WebView. Проверка на отсутствующий Bridge/WebView сохраняет native fallback Capacitor при недоступном WebView. Другие WebView рекламных SDK и системные настройки не меняются.
- `app/globals.css`, правило `button`: `touch-action: manipulation` задан непосредственно кнопкам, включая disabled-состояние. Это разрешает обычную прокрутку и не перехватывает клики/таймеры игры. Значение исключает двойное касание как способ увеличения; [Pointer Events](https://www.w3.org/TR/pointerevents3/#the-touch-action-css-property). Общего `touch-action: none`, глобального touch handler и подавления всех touch events не добавлено.
- `app/globals.css`, `.store-shell > .section-screen-header`: sticky-панель с `top: 0`, верхним safe-area padding, непрозрачным фоном темы и слоем выше карточек. Отступ сверху перенесён с контейнера на панель. Прокрутка магазина остаётся обычной прокруткой документа; React state/listeners для закрепления не требуются.
- Android candidate получил номер 51, имя версии остаётся 0.7.9. SDK/profile, Room constructor guard, подпись, данные, механика и экономика сохранены.

**Ограничение по увеличению:** оригинальный жест на установленной игре автоматически не воспроизведён. Подготовлено отдельное временное native-приложение `TTTP UI Check` с тем же WebView, CSS и серией из 30 касаний; телефон отклонил его установку с `INSTALL_FAILED_USER_RESTRICTED`. Защита устройства не обходилась. Поэтому новые настройки — дополнительная защита существующей политики масштаба, а не доказательство установленной причины первоначального увеличения. Требуется повторная проверка быстрого нажатия в Play-signed APK 51.

## Проверка магазина

В отдельном localhost fixture отрендерен **настоящий StoreScreen** через React SSR с синтетическими props и отключённым рекламным adapter. CSS взят из проекта. Учётные записи, сохранения и backend не использовались. Выполнена реальная прокрутка в Chromium через Browser; измерены `getBoundingClientRect()` и горизонтальное переполнение.

| Сценарий | До изменения | После изменения |
|---|---|---|
| 393 × 851, прокрутка вниз | Header top: 20 → −123 px, bottom −77 px: панель вне экрана | Header top 0 px, bottom 82 px |
| 320 × 568, прокрутка вниз | Не измерялся отдельно | Header top 0 px; горизонтального переполнения нет |
| 851 × 393, прокрутка вниз | Не измерялся отдельно | Header top 0 px, bottom 95 px; переполнения нет |
| 393 × 851, тёмная тема | Не измерялся отдельно | Header top 0 px; непрозрачный фон `rgb(17, 17, 17)` |

Физический safe-area inset и touch gesture WebView эта настольная проверка не эмулирует. CSS использует существующий `env(safe-area-inset-top)`. Synthetic double click мышью не выдаётся за Android double tap.

## Проверки выпуска

`pnpm run quality`: PASS, 231 тест; architecture, TypeScript, ESLint, web production build, Android web build и asset budget прошли. Initial JS: 323 068 bytes без изменения. Все web assets: 1 171 053 → 1 171 250 bytes (+197 bytes CSS/имен ресурсов), без добавления JS для панели.

Android release protocol: PASS за 294,70 секунды — `bundleRelease`, `assembleRelease`, native unit tests, release policy/Room constructor tests и optimization tests. Независимое измерение AAB, bundletool validation, APK/AAB signature verification, certificate pin и APK ZIP alignment 16 KiB прошли.

Свежий **полный Android lint завершился ошибкой: 1 error / 19 warnings**. Сравнение с известными ошибками прошло (`no-new-errors`); осталась прежняя `NotificationPermission` в Picasso. Исключение и срок 2026-10-07 не расширялись. Этот результат не обозначается как полный lint PASS.

| Метрика | 50 | 51 |
|---|---:|---:|
| AAB, bytes | 35 170 528 | 35 170 622 |
| APK, bytes | 25 494 911 | 25 494 943 |
| Все DEX, bytes | 40 646 900 | 40 646 932 |
| Class / method definitions | 42 237 / 243 027 | 42 237 / 243 027 |
| Method-ID slots | 272 975 | 272 975 |
| Native bytes / entries | 3 460 752 / 20 | 3 460 752 / 20 |
| R8 optimization / obfuscation / shrinking, % | 27,11 / 27,23 / 27,22 | 27,11 / 27,23 / 27,22 |

SHA-256 AAB 51: `f5c2b30ce9daedb005a8071b6fa8c55c3586779a77ce1f5554724b34b210a2dc`. Локальный файл для загрузки: `work/mobile-ui-2026-09-08/tic-tac-toe-plus-0.7.9-51.aab`. Android-артефакты автоматически не загружаются в Google Play. На телефоне остаётся версия 50; новый локальный APK не устанавливается поверх Play-подписи.

Локальные воспроизводящие файлы, результаты и сборки: ignored `work/mobile-ui-2026-09-08/`. Чужие изменения документации не включаются в commit. `GAME_DESIGN.md` не редактировался.
