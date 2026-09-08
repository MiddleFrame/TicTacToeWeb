# Падение Android 49 при запуске

Дата: 2026-09-08. Исходный commit: `f7dced32a97725ff88624f4f549b8b8a3259704a`. Это расследование реального сбоя после исторического аудита, а не пересмотр его измерений.

## Результат расследования

На разрешённом владельцем телефоне (Android 15/API 35, arm64, WebView 151.0.7922.199) воспроизведено немедленное падение **подписанного Google APK 49 / 0.7.9**, полученного владельцем из Play Console. APK установлен обновлением поверх 48; приложение не удалялось, данные не очищались и не читались. SHA-256 APK: `166117af8fff1f097cc4ea8a75206f3ae211fc0c60ddf23ef5574571853cbd8f`.

`am start -W` возвращает `Status: ok`, но процесс немедленно завершается. Поэтому успешный результат команды запуска сам по себе не является проверкой работоспособности. В crash buffer:

```text
java.lang.RuntimeException: Unable to get provider androidx.startup.InitializationProvider
java.lang.RuntimeException: Failed to create an instance of class androidx.work.impl.WorkDatabase.canonicalName
androidx.work.WorkManagerInitializer.create
```

Map ID отклонённого APK: `8f9ee05841e03d6c208d9649a7564667a611e50111e1a61544add53e1e50b27e`. Последняя локальная сборка до исправления имеет другой map ID, `092f8d9c4beff2aee353a083fab7a99ac7cd4b6f14a7813847f38971a93391d7`; её mapping нельзя применять к стеку из Play. Дефект обеих сборок проверен независимо.

Причина: в разрешённом графе находятся WorkManager 2.8.1 и Room 2.5.2. Consumer rule Room сохраняет подклассы `RoomDatabase`, но не указывает конструктор. В R8 full mode сохранение класса не означает сохранение неявного конструктора. В `usage.txt` последней локальной сборки прямо перечислены удалённые `public void <init>()` для `androidx.work.impl.WorkDatabase_Impl` и `com.moloco.sdk.acm.db.MetricsDb_Impl`; в `seeds.txt` сохранены только классы.

Это согласуется с [документацией R8 full mode](https://r8.googlesource.com/r8.git/+/03e5f7b3bd20819075e9ae765509d9369126bb36/compatibility-faq.md) и [изменением R8, ограничивающим неявное сохранение конструктора compatibility mode](https://r8.googlesource.com/r8/+/06e32a8d0d2e7e28bc4e597e4ce96e2e0c229d08). [Исходное правило AndroidX Room](https://android.googlesource.com/platform/frameworks/support/+/19f823a65c621aaffd9bdb11c308c0406acf2224/room/room-runtime/proguard-rules.pro) соответствует извлечённому правилу установленной зависимости. Не следует переносить описание неявного конструктора из общей страницы keep rules на full mode без проверки.

Это подтверждённая причина локально воспроизведённого падения отклонённого APK. Стек проверки Google недоступен, поэтому нельзя утверждать, что у проверяющего не было других сбоев. Известная lint-ошибка Picasso `NotificationPermission` не является этим стеком.

## Узкое исправление и защита от повторения

- В `android/app/proguard-rules.pro` добавлено сохранение только `public <init>()` у подклассов `androidx.room.RoomDatabase`. Методы, поля и весь пакет не сохраняются дополнительно. Исходные AAR, SDK/network profile, full mode, подпись, схема баз и игровая экономика не изменяются.
- В `android/gradle/room-constructor-verification.gradle` добавлена проверка DEX: оба реально используемых generated database класса должны содержать публичный конструктор без аргументов с кодом. `bundleRelease` проверяет все DEX раздела `base/dex`, обнаруживает отсутствующий/дублирующийся класс и останавливается при регрессии. Это проверка артефакта; она не заменяет запуск Activity.
- `testReleasePolicy` запускает проверки DEX parser: положительный случай, непубличный метод, другое имя, аргументы, отсутствие кода, усечённый DEX, отсутствующие обязательные классы. Новый gate **отклоняет сохранённый старый AAB** из-за обоих отсутствующих конструкторов.
- Release candidate получил `versionCode=50`, `versionName=0.7.9`. Номер 49 уже использован в Play; пересборка с тем же номером не заменяет загруженный артефакт.

## Воспроизведение на ART без доступа к данным игры

[RoomConstructorProbe.java](audit-support/RoomConstructorProbe.java) вызывает `Class.forName(...).getDeclaredConstructor().newInstance()` для указанных классов. Он запускается через Android `app_process` с **готовым release APK** в classpath, не пересобирает SDK и не использует неминифицированные классы. Только типы ошибок и имена классов попадают в вывод; база игры и файлы аккаунта не открываются. Это проверка создания объектов на реальном ART, а не полный Android lifecycle/Room database open/медиация.

После отдельного разрешения владельца на диагностические файлы и команды:

```powershell
javac --release 8 -d work/room-probe docs/audit-support/RoomConstructorProbe.java
d8 --min-api 25 --output work/room-probe/probe.jar work/room-probe/RoomConstructorProbe.class
adb push work/room-probe/probe.jar /data/local/tmp/tttp-room-probe.jar
adb push android/app/build/outputs/apk/release/app-release.apk /data/local/tmp/tttp-room-candidate.apk
adb shell 'CLASSPATH=/data/local/tmp/tttp-room-probe.jar:/data/local/tmp/tttp-room-candidate.apk app_process /system/bin RoomConstructorProbe androidx.work.impl.WorkDatabase_Impl com.moloco.sdk.acm.db.MetricsDb_Impl'
adb shell rm /data/local/tmp/tttp-room-probe.jar /data/local/tmp/tttp-room-candidate.apk
```

Создать `work/room-probe` заранее; `javac` — Java 21, `d8` — установленные SDK build-tools. Команды используют отдельные временные файлы, не `pm clear`, не uninstall и не файлы приложения. В расследовании использованы имена с суффиксом даты для изоляции.

До исправления probe возвращает `NoSuchMethodException` для **обоих** классов как с APK из Play, так и с последним локальным APK. Отсутствие конструктора подтверждено исполнением на телефоне, а не только текстом keep rules.

## Проверки и ограничения

Release protocol кандидата завершился за 348,50 секунды: `bundleRelease`, `assembleRelease`, native unit tests, release policy/DEX constructor tests и optimization tests прошли. `quality` прошёл: 231 тест, architecture/typecheck, ESLint, web production build, Android web build и web budget. Новых веб-изменений в этом исправлении нет.

| Проверка на том же ART/API 35 | APK 49 из Play | Последний локальный APK 49 | Исправленный локальный APK 50 |
|---|---|---|---|
| `WorkDatabase_Impl` public no-arg constructor | `NoSuchMethodException` | `NoSuchMethodException` | PASS, объект создан |
| `MetricsDb_Impl` public no-arg constructor | `NoSuchMethodException` | `NoSuchMethodException` | PASS, объект создан |
| Полный запуск Activity | Немедленное падение | Не устанавливался из-за подписи | Ожидает APK с подписью Google |

| Метрика | Последний локальный 49 | Кандидат 50 | Изменение |
|---|---:|---:|---:|
| AAB, bytes | 35 063 594 | 35 170 528 | +106 934 |
| APK, bytes | 25 445 759 | 25 494 911 | +49 152 |
| Все 5 DEX, bytes | 40 556 968 | 40 646 900 | +89 932 |
| Class definitions | 42 217 | 42 237 | +20 |
| Method definitions | 242 773 | 243 027 | +254 |
| Method-ID slots | 272 211 | 272 975 | +764 |
| Native bytes / entries | 3 460 752 / 20 | 3 460 752 / 20 | 0 |
| Bundled web bytes | 1 171 053 | 1 171 053 | 0 |
| R8 optimization / obfuscation / shrinking, % | 27,03 / 27,16 / 27,15 | 27,11 / 27,23 / 27,22 | +0,08 / +0,07 / +0,07 п. п. |

Размер увеличился из-за возвращения доступного через конструктор кода баз. Все budgets прошли без увеличения лимитов. Native libraries и bundled web assets побайтно совпадают по SHA-256 каждого entry. Изменение coverage не означает измеренного улучшения FPS, startup, CPU или памяти.

Независимый AAB inspector подтвердил DEX/native измерения. Bundletool validation, APK/AAB signature verification, неизменный certificate pin и APK ZIP 16 KiB alignment прошли. В новом `seeds.txt` присутствуют оба конструктора. Диагностические APK/JAR из `/data/local/tmp` удалены; файлы установленной игры не удалялись.

Свежий **полный Android lint завершился ошибкой: 1 error / 19 warnings**. Отдельное сравнение с известными ошибками прошло (`no-new-errors`): осталась только прежняя `NotificationPermission` в пути Picasso. Исключение и его срок 2026-10-07 не изменены. Этот результат нельзя описывать как успешный полный Android lint.

SHA-256 AAB 50: `8a0f561eb62aea51fd23910f67ad869237ef9af1242f67a031517810f9348625`. Санитизированные результаты: [android-startup-crash-49-proof.json](audit-support/android-startup-crash-49-proof.json).

Установленная версия 48 и загруженный APK 49 имеют один публичный сертификат; локальные APK подписаны другим действующим сертификатом. `adb install -r` локального APK закономерно завершается `INSTALL_FAILED_UPDATE_INCOMPATIBLE`. Подписи не менялись. Для установки исправленного приложения обновлением с сохранением данных нужен APK 50, подписанный Play App Signing. [Google описывает получение подписанного универсального APK](https://support.google.com/googleplay/android-developer/answer/9844279?hl=ru).

Никакие Android-артефакты в Google Play автоматически не загружались. Следующее действие владельца: загрузить AAB 50 в тестовый выпуск, получить после обработки подписанный универсальный APK 50 и передать для полной проверки запуска. Публиковать исправление всем пользователям до этой проверки не следует. Пока на телефоне установлен отклонённый APK 49; он воспроизводимо падает, сохранённые данные не удалены.

Локальные артефакты и машинные результаты находятся в ignored `work/device-startup-check-2026-09-08/`. Ключи подписи, приватные настройки, токены и пользовательские данные не читались и не публиковались.
