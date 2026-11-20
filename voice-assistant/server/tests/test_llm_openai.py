# Developer: @yfeeeee
import asyncio
import json
import os
import sys
from types import SimpleNamespace

import pytest

from app.agent import TOOLS, Agent
from app.config import DEFAULT_LLM_BASE_URL, DEFAULT_LLM_MODEL, Settings
from app.llm import LLMError, OpenAICompatLLM, to_openai_messages, to_openai_tools
from app.main import create_app
from app.matching import Contact
from app.pending import PendingStore

from helpers import FakeTelegram, asgi_request


class FakeHTTP:
    """Подставляет ответы провайдера по очереди: (status, json_or_text)."""

    def __init__(self, replies):
        self.replies = list(replies)
        self.requests = []

    async def post(self, url, json=None, headers=None):
        self.requests.append({"url": url, "json": json, "headers": headers})
        status, body = self.replies.pop(0)
        text = body if isinstance(body, str) else __import__("json").dumps(body)
        return SimpleNamespace(
            status_code=status, text=text, json=lambda: body if not isinstance(body, str) else {}
        )


def completion(content=None, tool_calls=None):
    message = {"role": "assistant", "content": content}
    if tool_calls:
        message["tool_calls"] = tool_calls
    return {"choices": [{"message": message}]}


def tc(call_id, name, args):
    return {"id": call_id, "type": "function", "function": {"name": name, "arguments": json.dumps(args)}}


def run(coro):
    return asyncio.run(coro)


def test_tools_and_history_conversion():
    tools = to_openai_tools(TOOLS)
    assert tools[0]["type"] == "function" and tools[0]["function"]["name"] == "play_music"
    assert tools[0]["function"]["parameters"]["required"] == ["query"]

    history = [
        {"role": "user", "content": "включи джаз"},
        {
            "role": "assistant",
            "content": [
                {"type": "text", "text": "Сейчас."},
                {"type": "tool_use", "id": "c1", "name": "play_music", "input": {"query": "джаз"}},
            ],
        },
        {"role": "user", "content": [{"type": "tool_result", "tool_use_id": "c1", "content": "ok"}]},
    ]
    out = to_openai_messages("SYS", history)
    assert out[0] == {"role": "system", "content": "SYS"}
    assert out[1] == {"role": "user", "content": "включи джаз"}
    assert out[2]["content"] == "Сейчас." and out[2]["tool_calls"][0]["id"] == "c1"
    assert json.loads(out[2]["tool_calls"][0]["function"]["arguments"]) == {"query": "джаз"}
    assert out[3] == {"role": "tool", "tool_call_id": "c1", "content": "ok"}


def test_complete_parses_tool_calls_and_text():
    http = FakeHTTP([(200, completion(tool_calls=[tc("a", "set_timer", {"seconds": 60})]))])
    llm = OpenAICompatLLM("KEY", "m", http=http)
    resp = run(llm.complete("sys", [{"role": "user", "content": "таймер"}], TOOLS))
    assert resp.stop_reason == "tool_use"
    assert resp.tool_calls[0].name == "set_timer" and resp.tool_calls[0].input == {"seconds": 60}
    assert resp.content[0]["type"] == "tool_use"
    req = http.requests[0]
    assert req["url"] == "https://api.groq.com/openai/v1/chat/completions"
    assert req["headers"]["Authorization"] == "Bearer KEY" and req["json"]["model"] == "m"

    http = FakeHTTP([(200, completion("Готово."))])
    resp = run(OpenAICompatLLM("K", "m", http=http).complete("s", [{"role": "user", "content": "x"}], TOOLS))
    assert resp.stop_reason == "end_turn" and resp.text == "Готово."


def test_bad_tool_arguments_become_empty_dict():
    call = {"id": "a", "type": "function", "function": {"name": "play_music", "arguments": "{oops"}}
    http = FakeHTTP([(200, completion(tool_calls=[call]))])
    resp = run(OpenAICompatLLM("K", "m", http=http).complete("s", [{"role": "user", "content": "x"}], TOOLS))
    assert resp.tool_calls[0].input == {}


def test_rate_limit_and_auth_errors_have_voice_messages():
    for status, fragment in [(429, "лимит"), (401, "Ключ")]:
        llm = OpenAICompatLLM("K", "m", http=FakeHTTP([(status, "x")]))
        with pytest.raises(LLMError) as err:
            run(llm.complete("s", [{"role": "user", "content": "x"}], TOOLS))
        assert fragment in err.value.user_message


def test_retries_once_on_tool_use_failed_and_5xx():
    ok = (200, completion("Ок."))
    for first in [(400, "tool_use_failed: bad call"), (503, "unavailable")]:
        http = FakeHTTP([first, ok])
        resp = run(
            OpenAICompatLLM("K", "m", http=http, retry_delay=0).complete(
                "s", [{"role": "user", "content": "x"}], TOOLS
            )
        )
        assert resp.text == "Ок." and len(http.requests) == 2
    http = FakeHTTP([(500, "e"), (500, "e")])
    with pytest.raises(LLMError):
        run(OpenAICompatLLM("K", "m", http=http, retry_delay=0).complete("s", [{"role": "user", "content": "x"}], TOOLS))
    assert len(http.requests) == 2


def test_agent_full_flow_with_openai_compat_provider():
    """Агент + провайдер: поиск контакта, подготовка сообщения, подтверждение."""
    http = FakeHTTP(
        [
            (200, completion(tool_calls=[tc("1", "find_contact", {"name": "Ане"})])),
            (200, completion(tool_calls=[tc("2", "send_telegram", {"contact_id": 101, "text": "Привет"})])),
        ]
    )
    telegram = FakeTelegram([Contact(101, "Аня")])
    agent = Agent(OpenAICompatLLM("K", "m", http=http), telegram, PendingStore())
    res = run(agent.handle("напиши Ане привет"))
    assert res["confirm"] and telegram.sent == []
    second_request = http.requests[1]["json"]["messages"]
    assert second_request[-1]["role"] == "tool" and "Аня" in second_request[-1]["content"]
    assert run(agent.confirm(res["confirm"]["id"], True))["reply"].startswith("Отправил")
    assert telegram.sent == [(101, "Привет")]


def test_provider_failure_returns_voice_reply_not_500():
    llm = OpenAICompatLLM("K", "m", http=FakeHTTP([(429, "x")]))
    app = create_app(Agent(llm, FakeTelegram([]), PendingStore()), "tok")
    status, body = run(asgi_request(app, "POST", "/command", {"text": "привет"}, token="tok"))
    assert status == 200 and "лимит" in body["reply"] and body["actions"] == []


def _settings(env):
    for key in list(os.environ):
        if key.startswith(("LLM_", "RELAY_", "TG_", "ASSISTANT_", "ANTHROPIC_", "CLAUDE_")):
            del os.environ[key]
    os.environ.update({"ASSISTANT_TOKEN": "t", "RELAY_BOT_TOKEN": "b", "RELAY_OWNER_ID": "5", "RELAY_SECRET": "s"})
    os.environ.update(env)
    return Settings.from_env()


def test_settings_pick_provider(monkeypatch):
    saved = dict(os.environ)
    try:
        s = _settings({"LLM_API_KEY": "gsk"})
        assert s.uses_openai_compat and s.model == DEFAULT_LLM_MODEL and s.llm_base_url == DEFAULT_LLM_BASE_URL
        s = _settings({"LLM_API_KEY": "gsk", "LLM_MODEL": "qwen/x", "LLM_BASE_URL": "https://example.com/v1"})
        assert s.model == "qwen/x" and s.llm_base_url == "https://example.com/v1"
        s = _settings({"ANTHROPIC_API_KEY": "sk"})
        assert not s.uses_openai_compat and s.model == "claude-sonnet-5-5"
        with pytest.raises(RuntimeError, match="LLM_API_KEY"):
            _settings({})
    finally:
        os.environ.clear()
        os.environ.update(saved)
