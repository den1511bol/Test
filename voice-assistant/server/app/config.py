# Developer: @yfeeeee
from __future__ import annotations

import os
from dataclasses import dataclass


RELAY_VARS = ("RELAY_BOT_TOKEN", "RELAY_OWNER_ID", "RELAY_SECRET")
TELETHON_VARS = ("TG_API_ID", "TG_API_HASH", "TG_SESSION")


@dataclass(frozen=True)
class Settings:
    token: str
    anthropic_key: str
    model: str
    # Режим 1 (рекомендуется): мост через бота и юзербот Heroku/Hikka, сессия не хранится.
    relay_bot_token: str = ""
    relay_owner_id: int = 0
    relay_secret: str = ""
    # Режим 2: прямой вход Telethon по строке сессии.
    tg_api_id: int = 0
    tg_api_hash: str = ""
    tg_session: str = ""

    @property
    def uses_relay(self) -> bool:
        return bool(self.relay_bot_token)

    @classmethod
    def from_env(cls) -> "Settings":
        env = os.environ
        missing = [n for n in ("ASSISTANT_TOKEN", "ANTHROPIC_API_KEY") if not env.get(n)]

        relay_set = [n for n in RELAY_VARS if env.get(n)]
        telethon_set = [n for n in TELETHON_VARS if env.get(n)]
        if relay_set:
            missing += [n for n in RELAY_VARS if not env.get(n)]
        elif telethon_set:
            missing += [n for n in TELETHON_VARS if not env.get(n)]
        else:
            missing += ["RELAY_BOT_TOKEN/RELAY_OWNER_ID/RELAY_SECRET (или TG_API_ID/TG_API_HASH/TG_SESSION)"]
        if missing:
            raise RuntimeError("Не заданы переменные окружения: " + ", ".join(missing))

        return cls(
            token=env["ASSISTANT_TOKEN"],
            anthropic_key=env["ANTHROPIC_API_KEY"],
            model=env.get("CLAUDE_MODEL", "claude-sonnet-5-5"),
            relay_bot_token=env.get("RELAY_BOT_TOKEN", ""),
            relay_owner_id=int(env["RELAY_OWNER_ID"]) if relay_set else 0,
            relay_secret=env.get("RELAY_SECRET", ""),
            tg_api_id=int(env["TG_API_ID"]) if not relay_set else 0,
            tg_api_hash=env.get("TG_API_HASH", "") if not relay_set else "",
            tg_session=env.get("TG_SESSION", "") if not relay_set else "",
        )
