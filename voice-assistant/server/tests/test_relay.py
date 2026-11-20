# Developer: @yfeeeee
"""Сквозные тесты протокола: BotRelayGateway <-> модуль IfiRelay.

Bot API и Hikka/Telethon заменены заглушками; реальный Telegram и юзербот не затрагиваются.
"""
import asyncio
import importlib.util
import pathlib
import sys
import time
import types
from types import SimpleNamespace

import pytest

from app.matching import Contact
from app.relay import REQ_PREFIX, RES_PREFIX, BotRelayGateway, RelayError, pack, unpack

MODULE_PATH = pathlib.Path(__file__).resolve().parents[2] / "userbot" / "IfiRelay.py"
OWNER, BOT_CHAT, SECRET, BOT = 111, 222, "s3cret", "ifi_bot"


# ---------- заглушки Hikka / Telethon ----------


@pytest.fixture
def relay_module(monkeypatch):
    class Message:  # то, что модуль берёт из telethon.tl.types
        pass

    tl_types = types.ModuleType("telethon.tl.types")
    tl_types.Message = Message
    tl = types.ModuleType("telethon.tl")
    tl.__path__ = []
    tl.types = tl_types
    tl_utils = types.ModuleType("telethon.utils")
    tl_utils.get_display_name = lambda entity: entity.name
    telethon = types.ModuleType("telethon")
    telethon.tl, telethon.utils = tl, tl_utils

    class ConfigValue:
        def __init__(self, option, default=None, doc=None, validator=None):
            self.option, self.default = option, default

    class ModuleConfig(dict):
        def __init__(self, *values):
            super().__init__({v.option: v.default for v in values})

    loader = types.ModuleType("hk.loader")
    loader.tds = lambda cls: cls
    loader.Module = type("Module", (), {})
    loader.ConfigValue, loader.ModuleConfig = ConfigValue, ModuleConfig
    loader.validators = SimpleNamespace(String=lambda *a, **k: None, Hidden=lambda *a, **k: None)
    loader.watcher = lambda *a, **k: (lambda f: f)
    loader.command = lambda *a, **k: (lambda f: f)

    async def answer(message, text):
        message.answered = text

    hk_utils = types.ModuleType("hk.utils")
    hk_utils.answer = answer
    hk = types.ModuleType("hk")
    hk.loader, hk.utils = loader, hk_utils
    hk_modules = types.ModuleType("hk.modules")
    hk_modules.__path__ = []

    functions = types.ModuleType("telethon.tl.functions")
    contacts_mod = types.ModuleType("telethon.tl.functions.contacts")
    contacts_mod.GetContactsRequest = lambda hash=0: ("GetContacts", hash)
    stubs = {
        "telethon.tl.functions": functions, "telethon.tl.functions.contacts": contacts_mod,
        "telethon": telethon, "telethon.tl": tl, "telethon.tl.types": tl_types,
        "telethon.utils": tl_utils, "hk": hk, "hk.loader": loader, "hk.utils": hk_utils,
        "hk.modules": hk_modules,
    }
    for name, module in stubs.items():
        monkeypatch.setitem(sys.modules, name, module)

    spec = importlib.util.spec_from_file_location("hk.modules.IfiRelay", MODULE_PATH)
    mod = importlib.util.module_from_spec(spec)
    monkeypatch.setitem(sys.modules, "hk.modules.IfiRelay", mod)
    spec.loader.exec_module(mod)
    mod.MessageBase = Message
    return mod


# ---------- фейковые клиент юзербота и Bot API ----------


class FakeClient:
    def __init__(self, api, contacts):
        self.api = api
        self.contacts = [SimpleNamespace(id=i, name=n, bot=False) for i, n in contacts]
        self.contact_sends = []

    async def __call__(self, request):
        assert request[0] == "GetContacts"
        return SimpleNamespace(users=self.contacts)

    async def iter_dialogs(self, limit=None):
        for _ in ():
            yield _

    async def send_message(self, target, text):
        if target == BOT_CHAT:  # ответ боту -> появится в getUpdates сервера
            self.api.push_update(text)
        else:
            self.contact_sends.append((target, text))


class FakeResponse:
    def __init__(self, result):
        self._result = result

    def json(self):
        return {"ok": True, "result": self._result}


class FakeBotAPI:
    def __init__(self):
        self.updates = asyncio.Queue()
        self.sent_requests = []
        self.deleted = []
        self.deliver = None  # корутина доставки запроса модулю (None = юзербот «выключен»)
        self._n = 0

    def push_update(self, text, user_id=OWNER):
        self._n += 1
        self.updates.put_nowait(
            {"update_id": self._n, "message": {"message_id": self._n, "from": {"id": user_id}, "text": text}}
        )

    async def post(self, url, json=None):
        method, params = url.rsplit("/", 1)[1], json or {}
        if method == "sendMessage":
            self.sent_requests.append(params["text"])
            if self.deliver:
                asyncio.get_running_loop().create_task(self.deliver(params["text"]))
            return FakeResponse({"message_id": 1})
        if method == "getUpdates":
            try:
                first = await asyncio.wait_for(self.updates.get(), 0.05)
            except asyncio.TimeoutError:
                return FakeResponse([])
            batch = [first]
            while not self.updates.empty():
                batch.append(self.updates.get_nowait())
            return FakeResponse(batch)
        if method == "deleteMessage":
            self.deleted.append(params["message_id"])
        return FakeResponse(True)


def make_message(mod, text, username=BOT, is_bot=True, out=False):
    class FakeMessage(mod.MessageBase):
        pass

    msg = FakeMessage()
    msg.raw_text, msg.out, msg.chat_id, msg.deleted = text, out, BOT_CHAT, False
    sender = SimpleNamespace(username=username, bot=is_bot)

    async def get_sender():
        return sender

    async def delete():
        msg.deleted = True

    msg.get_sender, msg.delete = get_sender, delete
    return msg


class Env:
    def __init__(self, mod, contacts, timeout=2.0):
        self.api = FakeBotAPI()
        self.client = FakeClient(self.api, contacts)
        self.module = mod.IfiRelayMod()
        self.module.config["bot_username"] = BOT
        self.module.config["secret"] = SECRET
        self.module._client = self.client
        self.messages = []
        self.gateway = BotRelayGateway("TOKEN", OWNER, SECRET, http=self.api, timeout=timeout)

        async def deliver(text):
            msg = make_message(mod, text)
            self.messages.append(msg)
            await self.module.watcher(msg)

        self.api.deliver = deliver


def run(relay_module, contacts, scenario, timeout=2.0):
    async def main():
        env = Env(relay_module, contacts, timeout)
        await env.gateway.start()
        try:
            await scenario(env)
        finally:
            await env.gateway.stop()

    asyncio.run(main())


CONTACTS = [(101, "Аня Иванова"), (102, "Алексей"), (103, "Мама")]


# ---------- тесты ----------


def test_pack_unpack_roundtrip_and_tamper():
    text = pack(REQ_PREFIX, SECRET, {"op": "find", "name": "Аня"})
    assert unpack(REQ_PREFIX, SECRET, text) == {"op": "find", "name": "Аня"}
    assert unpack(REQ_PREFIX, "other", text) is None
    assert unpack(RES_PREFIX, SECRET, text) is None
    assert unpack(REQ_PREFIX, SECRET, text.replace("Аня", "Ваня")) is None
    assert unpack(REQ_PREFIX, SECRET, "IFI1 nosplit") is None


def test_find_then_send_end_to_end(relay_module):
    async def scenario(env):
        found = await env.gateway.search_contacts("Ане")
        assert found == [Contact(101, "Аня Иванова")]
        await env.gateway.send_message(101, "Привет, скоро буду")
        assert env.client.contact_sends == [(101, "Привет, скоро буду")]
        assert all(m.deleted for m in env.messages)  # запросы из чата убраны
        assert len(env.api.deleted) == 2  # и ответы тоже

    run(relay_module, CONTACTS, scenario)


def test_send_only_to_recently_found_contacts(relay_module):
    async def scenario(env):
        with pytest.raises(RelayError, match="не найден"):
            await env.gateway.send_message(101, "без поиска")
        await env.gateway.search_contacts("Мама")
        with pytest.raises(RelayError, match="не найден"):
            await env.gateway.send_message(101, "не тот, кого искали")  # Аня не искалась
        await env.gateway.send_message(103, "маме можно")
        assert env.client.contact_sends == [(103, "маме можно")]

    run(relay_module, CONTACTS, scenario)


def test_offer_expires(relay_module):
    async def scenario(env):
        await env.gateway.search_contacts("Мама")
        env.module._offered[103] = time.time() - 1  # время жизни вышло
        with pytest.raises(RelayError, match="не найден"):
            await env.gateway.send_message(103, "поздно")

    run(relay_module, CONTACTS, scenario)


def test_forged_wrong_sender_replay_and_stale_are_ignored(relay_module):
    mod = relay_module

    async def scenario(env):
        good = {"op": "send", "contact_id": 101, "text": "взлом", "id": "x1", "ts": int(time.time())}
        env.module._offered[101] = time.time() + 100  # даже если контакт «предложен»

        for text, kwargs in [
            (pack(REQ_PREFIX, "wrong-secret", good), {}),  # чужая подпись
            (pack(REQ_PREFIX, SECRET, good), {"username": "evil_bot"}),  # не тот бот
            (pack(REQ_PREFIX, SECRET, good), {"is_bot": False}),  # обычный пользователь
            (pack(REQ_PREFIX, SECRET, good), {"out": True}),  # своё исходящее
        ]:
            await env.module.watcher(make_message(mod, text, **kwargs))
        assert env.client.contact_sends == [] and env.api.updates.empty()

        # валидный запрос выполняется один раз; повтор того же id игнорируется
        valid = pack(REQ_PREFIX, SECRET, {**good, "text": "ок"})
        await env.module.watcher(make_message(mod, valid))
        await env.module.watcher(make_message(mod, valid))
        assert env.client.contact_sends == [(101, "ок")]
        assert env.api.updates.qsize() == 1

        # устаревший запрос отклоняется с ошибкой
        stale = pack(REQ_PREFIX, SECRET, {**good, "id": "x2", "ts": int(time.time()) - 120})
        await env.module.watcher(make_message(mod, stale))
        answer = unpack(RES_PREFIX, SECRET, env.api.updates.get_nowait()["message"]["text"])
        assert answer["ok"] is True  # первый (валидный) ответ
        answer = unpack(RES_PREFIX, SECRET, env.api.updates.get_nowait()["message"]["text"])
        assert answer["ok"] is False and "устаревш" in answer["error"]
        assert env.client.contact_sends == [(101, "ок")]

    run(relay_module, CONTACTS, scenario)


def test_unconfigured_module_does_nothing(relay_module):
    async def scenario(env):
        env.module.config["secret"] = ""
        text = pack(REQ_PREFIX, SECRET, {"op": "find", "name": "Аня", "id": "z", "ts": int(time.time())})
        await env.module.watcher(make_message(relay_module, text))
        assert env.api.updates.empty()

    run(relay_module, CONTACTS, scenario)


def test_gateway_ignores_replies_from_other_users(relay_module):
    async def scenario(env):
        env.api.deliver = None  # юзербот молчит
        task = asyncio.create_task(env.gateway.search_contacts("Аня"))
        await asyncio.sleep(0.1)
        request_id = next(iter(env.gateway._pending))
        forged = pack(RES_PREFIX, SECRET, {"id": request_id, "ok": True, "contacts": [{"id": 666, "name": "Злодей"}]})
        env.api.push_update(forged, user_id=999)  # не владелец
        with pytest.raises(RelayError, match="не отвечает"):
            await task

    run(relay_module, CONTACTS, scenario, timeout=0.5)


def test_gateway_timeout_when_userbot_offline(relay_module):
    async def scenario(env):
        env.api.deliver = None
        with pytest.raises(RelayError, match="не отвечает"):
            await env.gateway.send_message(101, "никто не слушает")
        assert env.gateway._pending == {}

    run(relay_module, CONTACTS, scenario, timeout=0.3)


def test_status_command(relay_module):
    async def scenario(env):
        msg = SimpleNamespace()
        await env.module.ifistatuscmd(msg)
        assert "@ifi_bot" in msg.answered and "задан" in msg.answered
        assert "s3cret" not in msg.answered  # секрет не раскрывается

    run(relay_module, CONTACTS, scenario)


def test_contact_matching_is_strict(relay_module):
    contacts = [(1, "Милая Бука"), (2, "Милана"), (3, "Аня"), (4, "Максим"), (5, "Бука")]
    rank = lambda q: [n for _, n in relay_module._rank(contacts, q)]  # noqa: E731
    assert rank("Милая бука") == ["Милая Бука"]
    assert rank("Ане") == ["Аня"]
    assert rank("милой буке") == ["Милая Бука"]
    assert rank("Дмитрий") == []
    assert "Максим" not in rank("Мила")
