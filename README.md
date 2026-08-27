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

Текущее направление развития, сетевые системы, сезоны, экономика и roguelike
зафиксированы в [GAME_DESIGN.md](GAME_DESIGN.md).

Параметры будущей Android-оболочки находятся в `android-config`. Закрытая папка
`android-config/private` содержит локальный release-ключ и не попадает в Git.

## Android

Android-оболочка находится в `android` и загружает опубликованную веб-версию игры.
Идентификатор приложения, версия и уровни SDK задаются в
`android-config/app.properties`, а release-подпись — в игнорируемом файле
`android-config/private/keystore.properties`.

```powershell
npm run android:bundle
```

Подписанный App Bundle создаётся в
`android/app/build/outputs/bundle/release/app-release.aab`.
