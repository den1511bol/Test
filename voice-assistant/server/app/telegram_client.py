# Developer: @yfeeeee
from __future__ import annotations

import time
from typing import Protocol

from .matching import Contact, rank_contacts


class TelegramGateway(Protocol):
    async def search_contacts(self, query: str) -> list[Contact]: ...

    async def send_message(self, contact_id: int, text: str) -> None: ...


class TelethonGateway:
    """Отправка от имени пользователя (user-сессия Telethon, StringSession)."""

    CACHE_TTL = 600

    def __init__(self, api_id: int, api_hash: str, session: str) -> None:
        from telethon import TelegramClient
        from telethon.sessions import StringSession

        self._client = TelegramClient(StringSession(session), api_id, api_hash)
        self._contacts: list[Contact] = []
        self._loaded_at = 0.0

    async def start(self) -> None:
        await self._client.connect()
        if not await self._client.is_user_authorized():
            raise RuntimeError("TG_SESSION недействительна: сгенерируйте её заново")

    async def stop(self) -> None:
        await self._client.disconnect()

    async def _load(self) -> list[Contact]:
        if self._contacts and time.monotonic() - self._loaded_at < self.CACHE_TTL:
            return self._contacts
        from telethon import utils

        found: dict[int, Contact] = {}
        for user in await self._client.get_contacts():
            found[user.id] = Contact(user.id, utils.get_display_name(user))
        async for dialog in self._client.iter_dialogs(limit=300):
            if dialog.is_user and not getattr(dialog.entity, "bot", False):
                found.setdefault(
                    dialog.entity.id, Contact(dialog.entity.id, utils.get_display_name(dialog.entity))
                )
        self._contacts = list(found.values())
        self._loaded_at = time.monotonic()
        return self._contacts

    async def search_contacts(self, query: str) -> list[Contact]:
        return rank_contacts(await self._load(), query)

    async def send_message(self, contact_id: int, text: str) -> None:
        await self._load()  # прогрев кеша сущностей, чтобы id резолвился в пользователя
        await self._client.send_message(contact_id, text)
