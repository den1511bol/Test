"""
Lootify Bridge: весь бот внутри приложения.
Developer: @yfeeeee

Идея: сообщение или нажатие кнопки из приложения превращается в обычное обновление Telegram
(Update) и отдаётся в тот же Dispatcher, что и настоящие сообщения. Обработчики бота работают без
изменений. Ответы бота перехватывает «записывающая» сессия: вместо отправки в Telegram она кладёт
текст, кнопки и правки сообщений в очередь, а приложение рисует их как чат.

Подключение: см. lootify_bot.py (рядом с lootify_app.install):
    bridge = lootify_botbridge.Bridge(dp, TOKEN, get_user_cb, username_cb)
    lootify_app.install(..., bridge=bridge)
"""
import asyncio
import time

from aiogram import Bot
from aiogram.client.session.base import BaseSession
from aiogram.exceptions import TelegramBadRequest
from aiogram.types import Message, User

MAX_OPS = 300          # очередь неснятых ответов на игрока
MAX_MSGS = 400         # сколько сообщений помним для нажатий на кнопки
RUN_TIMEOUT = 25       # сколько секунд ждём обработчик бота

_SEND = {"SendMessage", "SendPhoto", "SendDocument", "SendAnimation", "SendVideo", "SendSticker",
         "SendVoice", "SendAudio", "SendVideoNote", "SendDice", "SendInvoice", "SendPoll", "SendMediaGroup"}
_PLACEHOLDER = {"SendPhoto": "🖼 фото", "SendDocument": "📎 файл", "SendAnimation": "🎞 анимация",
                "SendVideo": "🎬 видео", "SendSticker": "🏷 стикер", "SendVoice": "🎤 голосовое",
                "SendAudio": "🎵 аудио", "SendVideoNote": "⭕ кружок", "SendDice": "🎲 кубик", "SendMediaGroup": "🖼 альбом"}
_EDIT = {"EditMessageText", "EditMessageCaption", "EditMessageReplyMarkup"}


def _markup(rm):
    """ReplyKeyboardMarkup / InlineKeyboardMarkup -> простой словарь для клиента."""
    if rm is None:
        return None, None
    try:
        d = rm.model_dump(exclude_none=True)
    except Exception:
        return None, None
    if "inline_keyboard" in d:
        rows = []
        for row in d["inline_keyboard"]:
            out = []
            for b in row:
                item = {"t": str(b.get("text", ""))[:64]}
                if b.get("callback_data") is not None:
                    item["d"] = str(b["callback_data"])[:64]
                elif b.get("url"):
                    item["u"] = str(b["url"])
                elif (b.get("web_app") or {}).get("url"):
                    item["w"] = str(b["web_app"]["url"])
                else:
                    continue
                out.append(item)
            if out:
                rows.append(out)
        return rows, None
    if "keyboard" in d:
        rows = [[str(b.get("text", "")) if isinstance(b, dict) else str(b) for b in row] for row in d["keyboard"]]
        return None, rows
    if d.get("remove_keyboard"):
        return None, "remove"
    return None, None


class _Rec(BaseSession):
    """Сессия-перехватчик: в Telegram ничего не отправляет, а записывает операции для приложения."""

    def __init__(self, uid: int, bridge):
        super().__init__()
        self.uid = uid
        self.bridge = bridge
        self.ops = []
        self.next_id = 1
        self.texts = {}   # id -> {"text", "html"}

    async def close(self):
        return None

    async def stream_content(self, url, headers=None, timeout=30, chunk_size=65536, raise_for_status=True):
        if False:
            yield b""

    def _push(self, op):
        self.ops.append(op)
        if len(self.ops) > MAX_OPS:
            del self.ops[:len(self.ops) - MAX_OPS]

    def _msg(self, bot, mid, text=None):
        return Message.model_validate({
            "message_id": mid, "date": int(time.time()), "chat": {"id": self.uid, "type": "private"},
            "from": {"id": bot.id, "is_bot": True, "first_name": "Lootify"}, "text": text,
        }, context={"bot": bot})

    async def make_request(self, bot, method, timeout=None):
        name = type(method).__name__
        if name in _SEND:
            mid = self.next_id
            self.next_id += 1
            text = getattr(method, "text", None) or getattr(method, "caption", None) or ""
            pm = getattr(method, "parse_mode", None)
            html = isinstance(pm, str) and pm.upper() == "HTML"
            ph = _PLACEHOLDER.get(name)
            if ph:
                text = (ph + ("\n" + text if text else "")) if not html else (ph + ("\n" + text if text else ""))
            kb, rk = _markup(getattr(method, "reply_markup", None))
            self._push({"t": "send", "id": mid, "text": str(text)[:4096], "html": html, "kb": kb or [], "rk": rk})
            self.texts[mid] = {"text": str(text)[:4096]}
            if len(self.texts) > MAX_MSGS:
                for k in sorted(self.texts)[:len(self.texts) - MAX_MSGS]:
                    self.texts.pop(k, None)
            msg = self._msg(bot, mid, str(text))
            return [msg] if name == "SendMediaGroup" else msg
        if name in _EDIT:
            mid = getattr(method, "message_id", None)
            if mid is None:
                return True
            op = {"t": "edit", "id": int(mid)}
            kb, _rk = _markup(getattr(method, "reply_markup", None))
            op["kb"] = kb or []
            if name != "EditMessageReplyMarkup":
                text = getattr(method, "text", None)
                if text is None:
                    text = getattr(method, "caption", None)
                pm = getattr(method, "parse_mode", None)
                op["text"] = str(text or "")[:4096]
                op["html"] = isinstance(pm, str) and pm.upper() == "HTML"
                self.texts[int(mid)] = {"text": op["text"]}
            self._push(op)
            return self._msg(bot, int(mid), op.get("text"))
        if name == "DeleteMessage":
            self._push({"t": "del", "id": int(getattr(method, "message_id", 0) or 0)})
            return True
        if name == "AnswerCallbackQuery":
            txt = getattr(method, "text", None)
            if txt:
                self._push({"t": "toast", "text": str(txt)[:300], "alert": bool(getattr(method, "show_alert", False))})
            return True
        if name in ("SendChatAction", "PinChatMessage", "UnpinChatMessage", "SetMyCommands",
                    "SetMessageReaction", "AnswerInlineQuery"):
            return True
        if name == "GetMe":
            un = ""
            try:
                un = await self.bridge.username_cb() or ""
            except Exception:
                pass
            return User(id=bot.id, is_bot=True, first_name="Lootify", username=un or None)
        raise TelegramBadRequest(method=method, message="Bad Request: not supported in the app")


class Bridge:
    def __init__(self, dp, token: str, get_user_cb, username_cb):
        self.dp = dp
        self.token = token
        self.get_user_cb = get_user_cb      # async (uid) -> dict игрока или None
        self.username_cb = username_cb      # async () -> имя бота
        self._st = {}                       # uid -> {"bot", "sess", "lock", "uid_seq"}
        self._seq = int(time.time())

    def _state(self, uid: int):
        st = self._st.get(uid)
        if st is None:
            sess = _Rec(uid, self)
            st = {"sess": sess, "bot": Bot(token=self.token, session=sess), "lock": asyncio.Lock()}
            self._st[uid] = st
            if len(self._st) > 2000:
                for k in list(self._st)[:500]:
                    if k != uid and not self._st[k]["lock"].locked():
                        self._st.pop(k, None)
        return st

    async def _from_user(self, uid: int, fallback_name: str) -> dict:
        import re
        u = await self.get_user_cb(uid) or {}
        disp = str(u.get("tg_display_name") or "")
        username = str(u.get("tg_username") or "").lstrip("@")
        disp = re.sub(r"\s*@[A-Za-z0-9_]{4,32}\s*$", "", disp).strip() or fallback_name or "Игрок"
        parts = disp.split(" ", 1)
        d = {"id": int(uid), "is_bot": False, "first_name": parts[0][:64] or "Игрок", "language_code": "ru"}
        if len(parts) > 1 and parts[1].strip():
            d["last_name"] = parts[1].strip()[:64]
        if username:
            d["username"] = username
        return d

    def _raw_message(self, st, uid, frm, mid, text, bot_msg=False):
        m = {"message_id": mid, "date": int(time.time()), "chat": {"id": int(uid), "type": "private", "first_name": frm["first_name"]},
             "text": text}
        if bot_msg:
            m["from"] = {"id": st["bot"].id, "is_bot": True, "first_name": "Lootify"}
        else:
            m["from"] = frm
        return m

    async def _feed(self, st, raw):
        try:
            await asyncio.wait_for(self.dp.feed_raw_update(st["bot"], raw), RUN_TIMEOUT)
        except asyncio.TimeoutError:
            st["sess"]._push({"t": "toast", "text": "Бот отвечает слишком долго, попробуй ещё раз", "alert": False})
        except Exception as e:
            print(f"[app] мост: ошибка обработчика: {e!r}")
            st["sess"]._push({"t": "toast", "text": "Ошибка в боте, попробуй ещё раз", "alert": False})

    def drain(self, uid: int) -> list:
        st = self._st.get(uid)
        if not st:
            return []
        ops, st["sess"].ops = st["sess"].ops, []
        return ops

    async def send_text(self, uid: int, name: str, text: str) -> list:
        st = self._state(uid)
        async with st["lock"]:
            frm = await self._from_user(uid, name)
            st["sess"].next_id += 1   # id входящего сообщения тоже занимает номер
            mid = st["sess"].next_id
            self._seq += 1
            await self._feed(st, {"update_id": self._seq, "message": self._raw_message(st, uid, frm, mid, text)})
            return self.drain(uid)

    async def press(self, uid: int, name: str, mid: int, data: str) -> list:
        st = self._state(uid)
        async with st["lock"]:
            frm = await self._from_user(uid, name)
            known = st["sess"].texts.get(int(mid))
            msg = self._raw_message(st, uid, frm, int(mid), (known or {}).get("text") or "", bot_msg=True)
            self._seq += 1
            raw = {"update_id": self._seq, "callback_query": {
                "id": f"app{self._seq}", "from": frm, "chat_instance": "lootify-app", "message": msg, "data": data}}
            await self._feed(st, raw)
            return self.drain(uid)
