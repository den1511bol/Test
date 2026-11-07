# Lootify

Мультиплеерная игра с общими боссами для всех игроков (PWA + Android-приложение).
**Developer: [@yfeeeee](https://t.me/yfeeeee)**

## Что внутри

- 28 общих боссов: HP общий, бьют все вместе в реальном времени, награда по вкладу (урон и число ударов)
- Каждый тип боссов роняет свой материал; материалы идут на улучшение снаряжения (уровни 1–7, редкость от обычной до реликтовой)
- Снаряжение: 3 вида оружия (вампиризм, истинный урон, оглушение) и 4 части брони, прочность и ремонт
- Крит, уклонение, регенерация, медикаменты с перезарядкой, отдых после поражения
- Рейтинг по урону, общий чат, счётчик онлайна
- Вход через **Telegram**: кнопка Telegram Login или ссылка на бота
- Сервер авторитарный: все бои и награды считает сервер, есть лимит ударов
- Данные хранятся в **PostgreSQL** (зависимость `pg`); без `DATABASE_URL` сервер пишет в JSON-файл (для локальной проверки)

## Деплой на Railway

1. Railway → **New Project → Deploy from GitHub repo** → этот репозиторий; **Settings → Networking → Generate Domain**.
2. **New → Database → Add PostgreSQL**; в сервисе игры переменная `DATABASE_URL` = `${{Postgres.DATABASE_URL}}`.
3. Переменные Telegram: `TELEGRAM_BOT_TOKEN` (токен от @BotFather) и, если бот называется не `autifh_bot`, `TELEGRAM_BOT_USERNAME`.
4. В @BotFather: `/setdomain` → выбери бота → домен сервиса без `https://`.

## Android-приложение (APK)

Собирает GitHub Actions (`.github/workflows/build-apk.yml`) при пуше в `app/` или вручную: **Actions → Build Android APK → Run workflow**.
Готовый `CoreHunters.apk` появляется в **Releases**. Приложение — обёртка (Capacitor) над сервером, обновления игры приходят без переустановки;
когда выходит новая версия APK, игра сама предложит скачать её.

## Переменные окружения

| Имя | Назначение |
| --- | --- |
| `DATABASE_URL` | PostgreSQL (на Railway: `${{Postgres.DATABASE_URL}}`) |
| `TELEGRAM_BOT_TOKEN` | токен бота для проверки входа |
| `TELEGRAM_BOT_USERNAME` | имя бота без `@` (по умолчанию `autifh_bot`) |
| `PORT` | порт (Railway задаёт сам) |
| `DEV_LOGIN=1` | только для локальной проверки: тестовый вход без Telegram |
