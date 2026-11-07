# ---------------------------------------------------------------------------
# Админ-команда «дамп»: выгрузка всей игровой базы файлами .jsonl.gz.
# Вставь этот блок в lootify_bot.py ПОСЛЕ функции text_admin_command_sticker
# (там же определены ADMIN_IDS, message_command, reply_to_user, _get_pool).
# Developer: @yfeeeee
# ---------------------------------------------------------------------------
import gzip as _gzip
import os as _os
import tempfile as _tempfile
import time as _time
from aiogram.types import FSInputFile

_DUMP_TABLES = (
    ("players", "user_id", "SELECT user_id, data::text AS d, updated_at FROM players ORDER BY user_id"),
    ("clans", "clan_id", "SELECT clan_id, data::text AS d, updated_at FROM clans ORDER BY clan_id"),
    ("kv_state", "key", "SELECT key, data::text AS d, updated_at FROM kv_state ORDER BY key"),
    ("banned_users", "user_id", "SELECT user_id, NULL::text AS d, banned_at AS updated_at FROM banned_users ORDER BY user_id"),
)
_DUMP_PART_LIMIT = 40 * 1024 * 1024  # лимит Telegram для бота 50 МБ, держим запас


async def _write_dump_parts(directory: str, stamp: str) -> list:
    """Пишет базу построчно (JSON Lines) в сжатые части. Данные не разбираются в Python,
    поэтому гигантские числа игроков остаются точными. Возвращает [(путь, строк)]."""
    parts = []
    state = {"raw": None, "gz": None, "path": None, "rows": 0}

    def open_part():
        path = _os.path.join(directory, f"lootify_dump_{stamp}_{len(parts) + 1}.jsonl.gz")
        raw = open(path, "wb")
        state.update(raw=raw, gz=_gzip.GzipFile(fileobj=raw, mode="wb", compresslevel=6), path=path, rows=0)

    def close_part():
        if state["gz"] is None:
            return
        state["gz"].close()
        state["raw"].close()
        parts.append((state["path"], state["rows"]))
        state["gz"] = None

    open_part()
    pool = _get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction(isolation="repeatable_read", readonly=True):
            for table, key_col, sql in _DUMP_TABLES:
                n = 0
                async for row in conn.cursor(sql, prefetch=500):
                    key = row[key_col]
                    key_json = str(key) if isinstance(key, int) else json.dumps(key, ensure_ascii=False)
                    ts = row["updated_at"].isoformat() if row["updated_at"] else ""
                    d = row["d"] if row["d"] is not None else "null"
                    line = f'{{"t":"{table}","k":{key_json},"u":"{ts}","d":{d}}}\n'
                    state["gz"].write(line.encode("utf-8"))
                    state["rows"] += 1
                    n += 1
                    if n % 300 == 0:
                        await asyncio.sleep(0)
                        if state["raw"].tell() > _DUMP_PART_LIMIT:
                            close_part()
                            open_part()
    close_part()
    return parts


@dp.message(lambda msg: msg.text and message_command(msg) in ("дамп", "dump", "выгрузка")
            and msg.from_user.id in ADMIN_IDS and msg.chat.type == "private")
async def text_admin_command_dump(message: Message):
    """Админ (только в личке): «дамп» — присылает файл(ы) со всей игровой базой (игроки, кланы, kv_state, баны)."""
    await reply_to_user(message, "Готовлю дамп базы, это может занять минуту…")
    stamp = _time.strftime("%Y%m%d_%H%M%S")
    with _tempfile.TemporaryDirectory() as tmp:
        try:
            parts = await _write_dump_parts(tmp, stamp)
        except Exception as e:
            await reply_to_user(message, f"Не удалось сделать дамп: {e}")
            return
        total_rows = sum(r for _, r in parts)
        for i, (path, rows) in enumerate(parts, 1):
            size_mb = _os.path.getsize(path) / 1048576
            await message.answer_document(
                FSInputFile(path),
                caption=f"Дамп Lootify, часть {i} из {len(parts)}: {rows} строк, {size_mb:.1f} МБ. Всего строк: {total_rows}",
            )
