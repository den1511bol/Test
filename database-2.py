"""
Слой доступа к PostgreSQL для Lootify RPG.

Хранит данные каждого игрока одной строкой (user_id -> JSONB) в таблице
players. Кланы и баны — отдельные таблицы, чтобы не пропадали при
пересборке контейнера на Railway.
"""

import asyncio
import json
import os
import ssl
from typing import Dict, List, Optional, Set
from urllib.parse import urlsplit, parse_qs, urlunsplit

import asyncpg

DATABASE_URL = os.getenv("DATABASE_URL", "")

_pool: Optional[asyncpg.Pool] = None
_pool_lock = asyncio.Lock()

CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS players (
    user_id BIGINT PRIMARY KEY,
    data JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
"""

CREATE_INDEX_SQL = """
CREATE INDEX IF NOT EXISTS players_updated_at_idx
    ON players (updated_at DESC);
"""

CREATE_BANNED_SQL = """
CREATE TABLE IF NOT EXISTS banned_users (
    user_id BIGINT PRIMARY KEY,
    banned_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
"""

CREATE_CLANS_SQL = """
CREATE TABLE IF NOT EXISTS clans (
    clan_id TEXT PRIMARY KEY,
    data JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
"""

CREATE_KV_SQL = """
CREATE TABLE IF NOT EXISTS kv_state (
    key TEXT PRIMARY KEY,
    data JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
"""

CONNECT_RETRIES = 5
CONNECT_RETRY_DELAY = 3.0


def _normalize_dsn(dsn: str) -> tuple:
    if not dsn:
        return dsn, False
    parts = urlsplit(dsn)
    query = parse_qs(parts.query)
    sslmode = (query.pop("sslmode", [""])[0] or "").lower()
    new_query = "&".join(f"{k}={v[0]}" for k, v in query.items())
    clean_dsn = urlunsplit((parts.scheme, parts.netloc, parts.path, new_query, parts.fragment))
    use_ssl = sslmode in ("require", "verify-ca", "verify-full", "prefer")
    if not sslmode and "railway" in parts.netloc.lower():
        use_ssl = True
    return clean_dsn, use_ssl


async def init_db() -> None:
    global _pool
    async with _pool_lock:
        if _pool is not None:
            return
        if not DATABASE_URL:
            raise RuntimeError(
                "DATABASE_URL не задан. Добавь PostgreSQL в Railway и пропиши "
                "переменную DATABASE_URL в сервисе бота."
            )

        clean_dsn, use_ssl = _normalize_dsn(DATABASE_URL)
        last_error: Optional[Exception] = None
        for attempt in range(1, CONNECT_RETRIES + 1):
            try:
                ssl_context = ssl.create_default_context()
                ssl_context.check_hostname = False
                ssl_context.verify_mode = ssl.CERT_NONE
                _pool = await asyncpg.create_pool(
                    dsn=clean_dsn,
                    min_size=1,
                    max_size=10,
                    ssl=ssl_context if use_ssl else None,
                    statement_cache_size=0,
                    command_timeout=30,
                )
                break
            except Exception as e:
                last_error = e
                print(f"[init_db] attempt {attempt}/{CONNECT_RETRIES} failed: {e}")
                if attempt < CONNECT_RETRIES:
                    await asyncio.sleep(CONNECT_RETRY_DELAY)

        if _pool is None:
            raise RuntimeError(f"Не удалось подключиться к БД: {last_error}")

        async with _pool.acquire() as conn:
            await conn.execute(CREATE_TABLE_SQL)
            await conn.execute(CREATE_INDEX_SQL)
            await conn.execute(CREATE_BANNED_SQL)
            await conn.execute(CREATE_CLANS_SQL)
            await conn.execute(CREATE_KV_SQL)


async def close_db() -> None:
    global _pool
    async with _pool_lock:
        if _pool is not None:
            await _pool.close()
            _pool = None


def _get_pool() -> asyncpg.Pool:
    if _pool is None:
        raise RuntimeError("База данных ещё не инициализирована — вызови init_db().")
    return _pool


async def load_all_users() -> Dict[str, dict]:
    pool = _get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch("SELECT user_id, data FROM players")
    result: Dict[str, dict] = {}
    for row in rows:
        raw = row["data"]
        result[str(row["user_id"])] = raw if isinstance(raw, dict) else json.loads(raw)
    return result


async def upsert_user(user_id: int, data: dict) -> None:
    pool = _get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO players (user_id, data, updated_at)
            VALUES ($1, $2::jsonb, NOW())
            ON CONFLICT (user_id) DO UPDATE
                SET data = EXCLUDED.data,
                    updated_at = NOW()
            """,
            int(user_id),
            json.dumps(data, ensure_ascii=False, default=str),
        )


async def upsert_many(users: Dict[str, dict]) -> None:
    if not users:
        return
    pool = _get_pool()
    rows = [
        (int(uid), json.dumps(data, ensure_ascii=False, default=str))
        for uid, data in users.items()
        if str(uid).isdigit()
    ]
    if not rows:
        return
    async with pool.acquire() as conn:
        await conn.executemany(
            """
            INSERT INTO players (user_id, data, updated_at)
            VALUES ($1, $2::jsonb, NOW())
            ON CONFLICT (user_id) DO UPDATE
                SET data = EXCLUDED.data,
                    updated_at = NOW()
            """,
            rows,
        )


async def delete_user(user_id: int) -> None:
    pool = _get_pool()
    async with pool.acquire() as conn:
        await conn.execute("DELETE FROM players WHERE user_id = $1", int(user_id))


# ----- bans (persistent) -----

async def load_banned_ids() -> Set[int]:
    pool = _get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch("SELECT user_id FROM banned_users")
    return {int(r["user_id"]) for r in rows}


async def upsert_banned_ids(banned: Set[int]) -> None:
    """Полная синхронизация списка банов с БД."""
    pool = _get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            await conn.execute("DELETE FROM banned_users")
            if banned:
                await conn.executemany(
                    "INSERT INTO banned_users (user_id) VALUES ($1) ON CONFLICT DO NOTHING",
                    [(int(uid),) for uid in banned],
                )


async def add_banned_id(user_id: int) -> None:
    pool = _get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            "INSERT INTO banned_users (user_id) VALUES ($1) ON CONFLICT DO NOTHING",
            int(user_id),
        )


async def remove_banned_id(user_id: int) -> None:
    pool = _get_pool()
    async with pool.acquire() as conn:
        await conn.execute("DELETE FROM banned_users WHERE user_id = $1", int(user_id))


# ----- clans (persistent) -----

async def load_all_clans() -> Dict[str, dict]:
    pool = _get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch("SELECT clan_id, data FROM clans")
    result: Dict[str, dict] = {}
    for row in rows:
        raw = row["data"]
        result[str(row["clan_id"])] = raw if isinstance(raw, dict) else json.loads(raw)
    return result


async def upsert_clan(clan_id: str, data: dict) -> None:
    pool = _get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO clans (clan_id, data, updated_at)
            VALUES ($1, $2::jsonb, NOW())
            ON CONFLICT (clan_id) DO UPDATE
                SET data = EXCLUDED.data,
                    updated_at = NOW()
            """,
            str(clan_id),
            json.dumps(data, ensure_ascii=False, default=str),
        )


async def upsert_many_clans(clans: Dict[str, dict]) -> None:
    if not clans:
        return
    pool = _get_pool()
    rows = [
        (str(cid), json.dumps(data, ensure_ascii=False, default=str))
        for cid, data in clans.items()
    ]
    async with pool.acquire() as conn:
        await conn.executemany(
            """
            INSERT INTO clans (clan_id, data, updated_at)
            VALUES ($1, $2::jsonb, NOW())
            ON CONFLICT (clan_id) DO UPDATE
                SET data = EXCLUDED.data,
                    updated_at = NOW()
            """,
            rows,
        )


async def delete_clan(clan_id: str) -> None:
    pool = _get_pool()
    async with pool.acquire() as conn:
        await conn.execute("DELETE FROM clans WHERE clan_id = $1", str(clan_id))


# ----- произвольное состояние (мировой босс, награды дня и т.п.) -----

async def load_kv(key: str) -> Optional[dict]:
    pool = _get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow("SELECT data FROM kv_state WHERE key = $1", str(key))
    if row is None:
        return None
    raw = row["data"]
    return raw if isinstance(raw, dict) else json.loads(raw)


async def save_kv(key: str, data: dict) -> None:
    pool = _get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO kv_state (key, data, updated_at)
            VALUES ($1, $2::jsonb, NOW())
            ON CONFLICT (key) DO UPDATE
                SET data = EXCLUDED.data,
                    updated_at = NOW()
            """,
            str(key),
            json.dumps(data, ensure_ascii=False, default=str),
        )
