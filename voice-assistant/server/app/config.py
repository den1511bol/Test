# Developer: @yfeeeee
from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    token: str
    anthropic_key: str
    model: str
    tg_api_id: int
    tg_api_hash: str
    tg_session: str

    @classmethod
    def from_env(cls) -> "Settings":
        missing = [
            name
            for name in (
                "ASSISTANT_TOKEN",
                "ANTHROPIC_API_KEY",
                "TG_API_ID",
                "TG_API_HASH",
                "TG_SESSION",
            )
            if not os.environ.get(name)
        ]
        if missing:
            raise RuntimeError("Не заданы переменные окружения: " + ", ".join(missing))
        return cls(
            token=os.environ["ASSISTANT_TOKEN"],
            anthropic_key=os.environ["ANTHROPIC_API_KEY"],
            model=os.environ.get("CLAUDE_MODEL", "claude-sonnet-5-5"),
            tg_api_id=int(os.environ["TG_API_ID"]),
            tg_api_hash=os.environ["TG_API_HASH"],
            tg_session=os.environ["TG_SESSION"],
        )
