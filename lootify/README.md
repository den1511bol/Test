# Файлы для бота Lootify (в репозиторий бота не залиты)

Developer: @yfeeeee

- `lootify_app.py` — новый модуль: вход вне Telegram (подписанный токен, ссылка на бота, Telegram Login), оболочка `/app` с меню игр. Кладётся рядом с `lootify_bot.py`.
- `lootify_app.patch` — 4 небольшие правки `lootify_bot.py` (`patch -p0 lootify_bot.py < lootify_app.patch` либо вручную).
- `lootify_dump_command.py` — админ-команда «дамп» (выгрузка базы файлом), вставляется в `lootify_bot.py`.

Деплой в Lootify только по команде владельца.
