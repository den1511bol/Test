# Developer: @yfeeeee
from __future__ import annotations

import secrets
import time
from dataclasses import dataclass
from typing import Callable


@dataclass
class PendingSend:
    contact_id: int
    contact_name: str
    text: str
    expires: float


class PendingStore:
    """Сообщения, ожидающие голосового «да»/«нет». Живут ограниченное время."""

    def __init__(self, ttl: float = 120.0, clock: Callable[[], float] = time.monotonic) -> None:
        self._ttl = ttl
        self._clock = clock
        self._items: dict[str, PendingSend] = {}

    def add(self, contact_id: int, contact_name: str, text: str) -> str:
        self._purge()
        pid = secrets.token_urlsafe(8)
        self._items[pid] = PendingSend(contact_id, contact_name, text, self._clock() + self._ttl)
        return pid

    def pop(self, pid: str) -> PendingSend | None:
        self._purge()
        return self._items.pop(pid, None)

    def _purge(self) -> None:
        now = self._clock()
        for key in [k for k, v in self._items.items() if v.expires <= now]:
            del self._items[key]
