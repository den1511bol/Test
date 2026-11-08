# Бурильщик: Глубь (Deep Drill)
Нативная игра на **Godot 4.3** (GDScript) для Android. **Разработчик: @yfeeeee**

Копайте вглубь подземелья бурильной машиной. Монстры встают на пути — шнек бьёт их, а они роняют ресурсы с разным шансом.
За ресурсы покупаются **30 шнеков** (5 биомов × 6), улучшения бура и перерождение за «ядра».

## Что внутри
- 5 биомов, 15 ресурсов, 15 монстров + 5 боссов (мутанты 6%), 30 шнеков, 7 улучшений, перерождение, бестиарий
- Баланс проверяется симулятором: `godot --headless -s tools/sim.gd`
- Офлайн-доход (до 12 ч), автосохранение, вибрация, звуки/музыка (если положить файлы)
- Облако + рейтинг глубины: сервер на **Railway + PostgreSQL** (`server/`)

## Графика
Все арты подхватываются из `assets/` по именам. Пока файла нет — рисуется временная заглушка с подписью.
Готовые **промты для генерации** всех 89 изображений и список файлов: [`ASSETS.md`](ASSETS.md).
Сгенерировали → положили в `raw/` → `python3 tools/process_assets.py raw` (вырезает фон, подгоняет размеры).

## Запуск
Откройте папку проекта в Godot 4.3 и нажмите ▶. Для APK используйте GitHub Actions (`.github/workflows/build-deepdrill.yml`):
APK появляется в Releases → `deepdrill-latest` и в артефактах сборки.

## Сервер (Railway + PostgreSQL)
1. Railway → New Project → Deploy from GitHub repo → в настройках сервиса **Root Directory = `deepdrill/server`**.
2. Add → Database → PostgreSQL; в переменные сервиса добавьте `DATABASE_URL` = `${{Postgres.DATABASE_URL}}`.
3. Settings → Networking → Generate Domain.
4. В GitHub: Settings → Secrets and variables → Actions → **Variables** → `DRILL_API_URL` = `https://<ваш-домен>.up.railway.app` — и пересоберите APK.
API: `POST /api/drill/register`, `PUT|GET /api/drill/save`, `GET /api/drill/leaderboard`, `GET /health`. Тесты: `cd server && npm test`.

## Структура
```
scripts/   Data (данные) · Game (бой/сохранение) · Stage (сцена) · вкладки · Cloud · Audio · Assets
tools/     sim.gd (баланс) · manifest.py/gen_prompts.py (промты) · process_assets.py (обработка арта)
server/    Node + PostgreSQL для Railway
```
Лицензия MIT © @yfeeeee
