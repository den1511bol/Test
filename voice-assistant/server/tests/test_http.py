# Developer: @yfeeeee
import asyncio

from app.agent import Agent
from app.main import create_app
from app.matching import Contact
from app.pending import PendingStore

from helpers import FakeLLM, FakeTelegram, asgi_request, final, tool_use

TOKEN = "secret-token"


def run(coro):
    return asyncio.run(coro)


def make_app(script):
    tg = FakeTelegram([Contact(101, "Аня")])
    agent = Agent(FakeLLM(script), tg, PendingStore())
    return create_app(agent, TOKEN), tg


def test_health_open_and_command_requires_token():
    app, _ = make_app([])
    assert run(asgi_request(app, "GET", "/health")) == (200, {"ok": True})
    assert run(asgi_request(app, "POST", "/command", {"text": "hi"}))[0] == 401
    assert run(asgi_request(app, "POST", "/command", {"text": "hi"}, token="wrong"))[0] == 401
    assert run(asgi_request(app, "POST", "/confirm", {"id": "x", "approve": True}))[0] == 401


def test_bad_requests():
    app, _ = make_app([])
    assert run(asgi_request(app, "POST", "/command", raw=b"not json", token=TOKEN))[0] == 400
    assert run(asgi_request(app, "POST", "/command", {"text": "  "}, token=TOKEN))[0] == 400
    assert run(asgi_request(app, "POST", "/command", [1], token=TOKEN))[0] == 400
    assert run(asgi_request(app, "POST", "/confirm", {"id": "x", "approve": "yes"}, token=TOKEN))[0] == 400


def test_full_flow_over_http():
    app, tg = make_app(
        [
            tool_use(("f", "find_contact", {"name": "Аня"})),
            tool_use(("s", "send_telegram", {"contact_id": 101, "text": "Привет"})),
        ]
    )
    status, body = run(asgi_request(app, "POST", "/command", {"text": "напиши Ане привет"}, token=TOKEN))
    assert status == 200 and body["confirm"] and tg.sent == []
    status, out = run(
        asgi_request(app, "POST", "/confirm", {"id": body["confirm"]["id"], "approve": True}, token=TOKEN)
    )
    assert status == 200 and tg.sent == [(101, "Привет")] and "Отправил" in out["reply"]


def test_music_over_http():
    app, _ = make_app([tool_use(("m", "play_music", {"query": "джаз"})), final("Включаю джаз.")])
    status, body = run(asgi_request(app, "POST", "/command", {"text": "включи джаз"}, token=TOKEN))
    assert status == 200 and body["actions"][0]["query"] == "джаз"
