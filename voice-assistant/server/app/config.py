# Developer: @yfeeeee
from __future__ import annotations

import os
from dataclasses import dataclass


RELAY_VARS = ("RELAY_BOT_TOKEN", "RELAY_OWNER_ID", "RELAY_SECRET")
TELETHON_VARS = ("TG_API_ID", "TG_API_HASH", "TG_SESSION")


DEFAULT_LLM_BASE_URL = "https://api.groq.com/openai/v1"
DEFAULT_LLM_MODEL = "openai/gpt-oss-120b"


@dataclass(frozen=True)
class Settings:
    token: str
    model: str
    # ИИ, вариант 1 (бесплатный): сервис с OpenAI-совместимым API, по умолчанию Groq.
    llm_api_key: str = ""
    llm_base_url: str = DEFAULT_LLM_BASE_URL
    # ИИ, вариант 2: Claude через Anthropic API (платный).
    anthropic_key: str = ""
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

    @property
    def uses_openai_compat(self) -> bool:
        return bool(self.llm_api_key)

    @classmethod
    def from_env(cls) -> "Settings":
        env = os.environ
        missing = [n for n in ("ASSISTANT_TOKEN",) if not env.get(n)]
        if not env.get("LLM_API_KEY") and not env.get("ANTHROPIC_API_KEY"):
            missing.append("LLM_API_KEY (бесплатный Groq) или ANTHROPIC_API_KEY")

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

        compat = bool(env.get("LLM_API_KEY"))
        return cls(
            token=env["ASSISTANT_TOKEN"],
            model=(
                env.get("LLM_MODEL", DEFAULT_LLM_MODEL)
                if compat
                else env.get("CLAUDE_MODEL", "claude-sonnet-5-5")
            ),
            llm_api_key=env.get("LLM_API_KEY", ""),
            llm_base_url=env.get("LLM_BASE_URL", DEFAULT_LLM_BASE_URL),
            anthropic_key=env.get("ANTHROPIC_API_KEY", ""),
            relay_bot_token=env.get("RELAY_BOT_TOKEN", ""),
            relay_owner_id=int(env["RELAY_OWNER_ID"]) if relay_set else 0,
            relay_secret=env.get("RELAY_SECRET", ""),
            tg_api_id=int(env["TG_API_ID"]) if not relay_set else 0,
            tg_api_hash=env.get("TG_API_HASH", "") if not relay_set else "",
            tg_session=env.get("TG_SESSION", "") if not relay_set else "",
        )
