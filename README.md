# Tic Tac Toe Plus

Самостоятельный веб-проект игры. Он не зависит от Unity, IL2CPP или файлов
старого проекта и может переноситься как отдельный репозиторий.

## Команды

```powershell
npm install
npm run dev
npm test
npm run lint
npm run build
```

Исходники приложения находятся в `app`, игровые ресурсы — в `public`, тесты — в
`tests`. Настройки текущего веб-хостинга сохранены в `.openai`.

Единый геймдизайн и все планы игры — в [GAME_DESIGN.md](GAME_DESIGN.md):
сетевые системы, сезоны, экономика, roguelike, коллекции и колоды, пропуски,
UI/UX и графика. Раздел 14 содержит подробный статус и оставшиеся задачи
по коллекциям, раздел 22 — общий порядок работ, раздел 26 — аудит изображений.
Готовые задания для отдельных глубоких проверок монетизации, Android/R8 и
архитектуры находятся в [docs/advanced-project-audit-prompts.md](docs/advanced-project-audit-prompts.md).

## База данных и эксплуатация

Рабочая база — Cloudflare D1 через Sites, а не подтверждённый D1 Free в личном
Cloudflare-аккаунте владельца. Кто управляет базой, чем она отличается от локальной
SQLite, какие квоты неизвестны и что потребуется для переноса:
[docs/infrastructure.md](docs/infrastructure.md).

Защита API и админка описаны в [docs/backend-foundation.md](docs/backend-foundation.md),
реализация удаления аккаунтов и оставшиеся проверки перед Google Play — в
[docs/account-deletion.md](docs/account-deletion.md).

Параметры будущей Android-оболочки находятся в `android-config`. Закрытая папка
`android-config/private` содержит локальный release-ключ и не попадает в Git.

## Android

Android-оболочка находится в `android`, а её автономный интерфейс — в
`android-client`. Локальные режимы и игровые ресурсы запускаются без сети;
подключение требуется только сетевым функциям.
Идентификатор приложения, версия и уровни SDK задаются в
`android-config/app.properties`, а release-подпись — в игнорируемом файле
`android-config/private/keystore.properties`.
Мастер launcher-иконки и версия для Google Play находятся в
`android-config/app-icon-source.png` и `android-config/app-icon-play-store.png`.

```powershell
npm run android:bundle
```

Подписанный App Bundle создаётся в
`android/app/build/outputs/bundle/release/app-release.aab`.
