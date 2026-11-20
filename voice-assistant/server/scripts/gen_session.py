# Developer: @yfeeeee
"""Запусти ЛОКАЛЬНО один раз: python scripts/gen_session.py
Скрипт спросит api_id, api_hash, номер и код из Telegram и выведет строку TG_SESSION.
Строка даёт полный доступ к аккаунту — храни её только в переменных Railway."""
from telethon.sessions import StringSession
from telethon.sync import TelegramClient

api_id = int(input("api_id: ").strip())
api_hash = input("api_hash: ").strip()

with TelegramClient(StringSession(), api_id, api_hash) as client:
    print("\nTG_SESSION=" + client.session.save())
