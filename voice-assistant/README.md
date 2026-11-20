# Голосовой помощник для Android

Разработчик: @yfeeeee

Помощник слушает слово-активатор при выключенном экране, понимает свободную речь (Claude), включает музыку в
YouTube Music, ставит таймеры и будильники и пишет друзьям в Telegram от вашего имени (только после голосового «да»).

```
Телефон (Kotlin)                          Railway (Python)
слово-активатор (openWakeWord, на устройстве)
 → SpeechRecognizer → текст ──HTTPS──►  /command → Claude + инструменты
 ◄── ответ + действия ◄──────────────   find_contact / send_telegram (Telethon)
 озвучка (TTS), YouTube Music, таймер   /confirm → отправка после «да»
```

## 1. Сервер на Railway

1. Проект лежит в папке `voice-assistant/` этого репозитория.
2. Railway → New Project → Deploy from GitHub → выберите репозиторий. В настройках сервиса задайте
   **Root Directory = `voice-assistant/server`** (конфиг запуска уже в `server/railway.json`).
3. Добавьте переменные из `server/.env.example`:
   - `ASSISTANT_TOKEN` — придумайте длинную случайную строку (то же значение вводится в приложении);
   - `ANTHROPIC_API_KEY`, при желании `CLAUDE_MODEL`;
   - `TG_API_ID`, `TG_API_HASH` — на https://my.telegram.org → API development tools;
   - `TG_SESSION` — строка сессии (следующий пункт).
4. Settings → Networking → Generate Domain, получите адрес вида `https://xxx.up.railway.app`.

### Строка сессии Telegram

Один раз локально: `pip install telethon && python voice-assistant/server/scripts/gen_session.py`. Скрипт спросит api_id, api_hash,
номер и код, затем выведет `TG_SESSION=...`. Эта строка даёт полный доступ к аккаунту: держите её только в
переменных Railway, никому не показывайте и не коммитьте.

## 2. Слово-активатор

Положите модель openWakeWord в `voice-assistant/models/wakeword.onnx` (см. `models/README.md` и `models/TRAIN_IFI.md`). Без неё сборка возьмёт тестовую
модель «alexa», чтобы можно было проверить весь конвейер.

## 3. Сборка APK

Каждый push в `voice-assistant/` запускает GitHub Actions (`.github/workflows/voice-assistant.yml` в корне репозитория): тесты сервера и сборка debug-APK. Скачайте
`voice-assistant-apk` из Artifacts запуска и установите на телефон (разрешите установку из неизвестных источников).

## 4. Настройка телефона

В приложении: адрес сервера и токен → кнопки 1–3 (микрофон и уведомления; «Поверх других окон» — без него Android
не даст запускать YouTube Music и таймер из фона; отключение оптимизации батареи) → «Сохранить и запустить».
Журнал внизу экрана можно скопировать и прислать при проблемах. Если слово срабатывает слишком редко или слишком часто,
меняйте порог (в журнале видно «Почти: 0.xx»).

## Что проверено, а что нет

- Сервер: 15 автотестов (`cd voice-assistant/server && PYTHONPATH=.:tests pytest tests`) с подменой Claude и Telegram. Реальные
  вызовы Anthropic API и Telegram не проверялись.
- Конвейер openWakeWord проверен на реальных моделях в Python (формы тензоров, прогрев буфера). Kotlin-версия
  **не компилировалась и не запускалась**: для этого нужен Android SDK и устройство.
- Автозапуск трека в YouTube Music зависит от версии приложения: если intent не принят, откроется поиск без запуска.
- Android 14+ ограничивает микрофон в фоне; на некоторых прошивках (Xiaomi, Huawei, Samsung) нужны дополнительные
  исключения из энергосбережения.
