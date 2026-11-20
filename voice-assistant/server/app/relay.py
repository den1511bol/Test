# Developer: @yfeeeee
"""Мост сервер <-> юзербот Heroku/Hikka через чат с Telegram-ботом.

Сервер не хранит сессию вашего аккаунта. Он отправляет подписанный запрос от имени бота в ваш чат с
ботом; модуль IfiRelay в юзерботе (уже авторизованном под вашим аккаунтом) выполняет его и отвечает
подписанным сообщением боту; сервер читает ответ через getUpdates.

Формат сообщения: "<префикс><hmac_sha256_hex> <json>". Подпись считается общим секретом RELAY_SECRET.
"""
from __future__ import annotations

import asyncio
import hashlib
import hmac
import json
import logging
import secrets
import time
from typing import Any

from .matching import Contact

REQ_PREFIX = "IFI1 "
RES_PREFIX = "IFI1R "

log = logging.getLogger("relay")


class RelayError(RuntimeError):
    pass


def sign(secret: str, body: str) -> str:
    return hmac.new(secret.encode(), body.encode(), hashlib.sha256).hexdigest()


def pack(prefix: str, secret: str, payload: dict[str, Any]) -> str:
    body = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    return f"{prefix}{sign(secret, body)} {body}"


def unpack(prefix: str, secret: str, text: str) -> dict[str, Any] | None:
    """Возвращает данные, только если префикс и подпись верны."""
    if not text.startswith(prefix):
        return None
    try:
        signature, body = text[len(prefix) :].split(" ", 1)
    except ValueError:
        return None
    if not hmac.compare_digest(signature, sign(secret, body)):
        return None
    try:
        data = json.loads(body)
    except ValueError:
        return None
    return data if isinstance(data, dict) else None


class BotRelayGateway:
    """Реализует TelegramGateway (search_contacts / send_message) через юзербота."""

    def __init__(
        self,
        bot_token: str,
        owner_id: int,
        secret: str,
        http: Any = None,
        timeout: float = 35.0,
    ) -> None:
        self._token = bot_token
        self._owner_id = owner_id
        self._secret = secret
        self._http = http
        self._own_http = http is None
        self._timeout = timeout
        self._pending: dict[str, asyncio.Future[dict[str, Any]]] = {}
        self._task: asyncio.Task[None] | None = None

    # ---- жизненный цикл ----

    async def start(self) -> None:
        if self._http is None:
            import httpx  # ставится вместе с anthropic

            self._http = httpx.AsyncClient(timeout=40)
        await self._api("getMe", {})
        # getUpdates не работает, пока у бота установлен webhook.
        await self._api("deleteWebhook", {})
        self._task = asyncio.create_task(self._poll())

    async def stop(self) -> None:
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        if self._own_http and self._http is not None:
            await self._http.aclose()

    # ---- интерфейс TelegramGateway ----

    async def search_contacts(self, query: str) -> list[Contact]:
        resp = await self._rpc({"op": "find", "name": query})
        if not resp.get("ok"):
            raise RelayError(str(resp.get("error", "ошибка поиска")))
        return [Contact(int(c["id"]), str(c["name"])) for c in resp.get("contacts", [])][:3]

    async def send_message(self, contact_id: int, text: str) -> None:
        resp = await self._rpc({"op": "send", "contact_id": contact_id, "text": text})
        if not resp.get("ok"):
            raise RelayError(str(resp.get("error", "не отправлено")))

    # ---- внутреннее ----

    async def _rpc(self, payload: dict[str, Any]) -> dict[str, Any]:
        request_id = secrets.token_urlsafe(6)
        payload = {**payload, "id": request_id, "ts": int(time.time())}
        future: asyncio.Future[dict[str, Any]] = asyncio.get_running_loop().create_future()
        self._pending[request_id] = future
        started = time.monotonic()
        log.info("relay -> %s id=%s", payload.get("op"), request_id)
        try:
            await self._api(
                "sendMessage",
                {"chat_id": self._owner_id, "text": pack(REQ_PREFIX, self._secret, payload)},
            )
            result = await asyncio.wait_for(future, self._timeout)
            log.info("relay <- id=%s за %.1f c", request_id, time.monotonic() - started)
            return result
        except asyncio.TimeoutError:
            log.warning("relay: ответа на id=%s нет за %.0f c", request_id, self._timeout)
            raise RelayError("Юзербот не отвечает") from None
        finally:
            self._pending.pop(request_id, None)

    async def _api(self, method: str, params: dict[str, Any]) -> Any:
        response = await self._http.post(
            f"https://api.telegram.org/bot{self._token}/{method}", json=params
        )
        data = response.json()
        if not data.get("ok"):
            raise RelayError(f"Bot API {method}: {data.get('description', 'ошибка')}")
        return data["result"]

    async def _poll(self) -> None:
        offset: int | None = None
        while True:
            try:
                params: dict[str, Any] = {"timeout": 25, "allowed_updates": ["message"]}
                if offset is not None:
                    params["offset"] = offset
                for update in await self._api("getUpdates", params):
                    offset = update["update_id"] + 1
                    await self._handle_update(update)
            except asyncio.CancelledError:
                raise
            except Exception as exc:  # noqa: BLE001 — не логируем текст: в нём может быть токен в URL
                log.warning("relay poll error: %s: %s", type(exc).__name__, str(exc).replace(self._token, "***")[:200])
                await asyncio.sleep(3)

    async def _handle_update(self, update: dict[str, Any]) -> None:
        message = update.get("message") or {}
        if (message.get("from") or {}).get("id") != self._owner_id:
            log.info("relay: апдейт от другого отправителя, пропуск")
            return
        data = unpack(RES_PREFIX, self._secret, message.get("text") or "")
        if data is None:
            log.info("relay: сообщение не IFI1R или неверная подпись, пропуск")
            return
        future = self._pending.get(str(data.get("id")))
        if future is not None and not future.done():
            future.set_result(data)
        # Служебные сообщения не копим в чате (в приватном чате бот может удалять входящие).
        try:
            await self._api(
                "deleteMessage",
                {"chat_id": self._owner_id, "message_id": message.get("message_id")},
            )
        except RelayError:
            pass
