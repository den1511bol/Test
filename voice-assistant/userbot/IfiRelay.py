# meta developer: @yfeeeee
# Developer: @yfeeeee
import hashlib
import hmac
import json
import time
from collections import deque
from difflib import SequenceMatcher

from telethon.tl.types import Message

from .. import loader, utils

REQ_PREFIX = "IFI1 "
RES_PREFIX = "IFI1R "
MAX_AGE = 60  # секунд: старые запросы отклоняются (защита от повтора)
OFFER_TTL = 600  # отправлять можно только контактам из поиска за последние 10 минут
CACHE_TTL = 600
MAX_TEXT = 4000
VERSION = "3 (строгий поиск)"


def _sign(secret, body):
    return hmac.new(secret.encode(), body.encode(), hashlib.sha256).hexdigest()


def _pack(secret, payload):
    body = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    return f"{RES_PREFIX}{_sign(secret, body)} {body}"


def _unpack(secret, text):
    if not text.startswith(REQ_PREFIX):
        return None
    try:
        signature, body = text[len(REQ_PREFIX):].split(" ", 1)
    except ValueError:
        return None
    if not hmac.compare_digest(signature, _sign(secret, body)):
        return None
    try:
        data = json.loads(body)
    except ValueError:
        return None
    return data if isinstance(data, dict) else None


def _score_word(query, word):
    """Сходство двух слов 0..1. Нечёткость только против опечаток распознавания речи."""
    if query == word:
        return 1.0
    # Падежи: «ане» ~ «аня», «милой» ~ «милая» (общее начало от 3 букв, хвост до 3 букв).
    common = 0
    for x, y in zip(query, word):
        if x != y:
            break
        common += 1
    shortest = min(len(query), len(word))
    if shortest >= 3 and abs(len(query) - len(word)) <= 3 and common >= max(2, shortest - 2):
        return 0.9
    ratio = SequenceMatcher(None, query, word).ratio()
    return ratio if ratio >= 0.8 else 0.0


def _score(query, name):
    """Каждое слово запроса должно найтись среди слов имени; оценка — по худшему слову."""
    q, n = query.strip().lower().replace("ё", "е"), name.strip().lower().replace("ё", "е")
    if not q or not n:
        return 0.0
    if q == n:
        return 1.0
    name_words = n.split()
    scores = [max(_score_word(w, nw) for nw in name_words) for w in q.split()]
    return min(scores) if scores else 0.0


def _rank(contacts, query, threshold=0.8, limit=3):
    scored = [(_score(query, name), cid, name) for cid, name in contacts]
    scored = [s for s in scored if s[0] >= threshold]
    scored.sort(key=lambda s: (-s[0], s[2]))
    return [(cid, name) for _, cid, name in scored[:limit]]


@loader.tds
class IfiRelayMod(loader.Module):
    """Мост для голосового помощника Ифи: ищет контакты и отправляет сообщения от вашего имени по подписанным запросам бота. Developer: @yfeeeee"""

    strings = {"name": "IfiRelay"}

    def __init__(self):
        self.config = loader.ModuleConfig(
            loader.ConfigValue(
                "bot_username",
                "",
                "Юзернейм бота помощника без @ (запросы принимаются только от него)",
                validator=loader.validators.String(),
            ),
            loader.ConfigValue(
                "secret",
                "",
                "Общий секрет, такой же как RELAY_SECRET на сервере",
                validator=loader.validators.Hidden(loader.validators.String()),
            ),
        )
        self._contacts = []
        self._loaded_at = 0.0
        self._offered = {}
        self._seen = deque(maxlen=200)

    async def client_ready(self, client, db):
        self._client = client

    # ---- команда для проверки настройки ----

    @loader.command()
    async def ifistatuscmd(self, message):
        """Показать, настроен ли мост"""
        bot = (self.config["bot_username"] or "").strip()
        ok_secret = bool(self.config["secret"])
        await utils.answer(
            message,
            f"IfiRelay v{VERSION}: бот = {'@' + bot if bot else 'не задан'}, "
            f"секрет = {'задан' if ok_secret else 'не задан'}",
        )

    # ---- приём запросов ----

    @loader.watcher(only_messages=True)
    async def watcher(self, message):
        # Самые дешёвые проверки первыми: watcher вызывается для каждого сообщения.
        if not isinstance(message, Message) or message.out:
            return
        text = message.raw_text or ""
        if not text.startswith(REQ_PREFIX):
            return
        bot = (self.config["bot_username"] or "").strip().lstrip("@").lower()
        secret = self.config["secret"]
        if not bot or not secret:
            return
        sender = await message.get_sender()
        if (
            sender is None
            or not getattr(sender, "bot", False)
            or (getattr(sender, "username", None) or "").lower() != bot
        ):
            return
        request = _unpack(secret, text)
        if request is None:
            return  # подпись неверна: молча игнорируем

        request_id = str(request.get("id", ""))
        if not request_id or request_id in self._seen:
            return
        self._seen.append(request_id)

        response = await self._handle(request, request_id)
        await self._client.send_message(message.chat_id, _pack(secret, response))
        try:
            await message.delete()
        except Exception:  # noqa: BLE001
            pass

    async def _handle(self, request, request_id):
        try:
            age = abs(time.time() - float(request.get("ts", 0)))
        except (TypeError, ValueError):
            age = MAX_AGE + 1
        if age > MAX_AGE:
            return {"id": request_id, "ok": False, "error": "устаревший запрос"}

        op = request.get("op")
        try:
            if op == "find":
                return await self._find(request, request_id)
            if op == "send":
                return await self._send(request, request_id)
        except Exception as exc:  # noqa: BLE001
            return {"id": request_id, "ok": False, "error": f"{type(exc).__name__}: {exc}"[:200]}
        return {"id": request_id, "ok": False, "error": "неизвестная операция"}

    async def _find(self, request, request_id):
        name = str(request.get("name", "")).strip()
        if not name:
            return {"id": request_id, "ok": False, "error": "пустое имя"}
        found = _rank(await self._load_contacts(), name)
        now = time.time()
        self._offered = {c: t for c, t in self._offered.items() if t > now}
        for cid, _ in found:
            self._offered[cid] = now + OFFER_TTL
        return {
            "id": request_id,
            "ok": True,
            "contacts": [{"id": cid, "name": cname} for cid, cname in found],
        }

    async def _send(self, request, request_id):
        try:
            contact_id = int(request.get("contact_id"))
        except (TypeError, ValueError):
            return {"id": request_id, "ok": False, "error": "неверный контакт"}
        text = str(request.get("text", "")).strip()
        if not text or len(text) > MAX_TEXT:
            return {"id": request_id, "ok": False, "error": "неверный текст"}
        if self._offered.get(contact_id, 0) <= time.time():
            return {"id": request_id, "ok": False, "error": "контакт не найден поиском"}
        await self._load_contacts()  # прогрев кэша сущностей
        await self._client.send_message(contact_id, text)
        return {"id": request_id, "ok": True}

    async def _load_contacts(self):
        if self._contacts and time.time() - self._loaded_at < CACHE_TTL:
            return self._contacts
        from telethon import utils as tl_utils

        found = {}
        from telethon.tl.functions.contacts import GetContactsRequest

        result = await self._client(GetContactsRequest(hash=0))
        for user in getattr(result, "users", []):
            if not getattr(user, "bot", False):
                found[user.id] = tl_utils.get_display_name(user)
        async for dialog in self._client.iter_dialogs(limit=300):
            entity = dialog.entity
            if dialog.is_user and not getattr(entity, "bot", False):
                found.setdefault(entity.id, tl_utils.get_display_name(entity))
        self._contacts = list(found.items())
        self._loaded_at = time.time()
        return self._contacts
