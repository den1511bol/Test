# Developer: @yfeeeee
from __future__ import annotations

import json
from typing import Any

from app.llm import LLMResponse, ToolCall
from app.matching import Contact


class FakeLLM:
    """Отдаёт заранее заданные ответы по очереди и запоминает, что ему присылали."""

    def __init__(self, script: list[LLMResponse]) -> None:
        self.script = list(script)
        self.calls: list[list[dict[str, Any]]] = []

    async def complete(self, system, messages, tools):  # noqa: ANN001
        self.calls.append(json.loads(json.dumps(messages)))
        return self.script.pop(0)


class FakeTelegram:
    def __init__(self, contacts: list[Contact]) -> None:
        self.contacts = contacts
        self.sent: list[tuple[int, str]] = []
        self.fail = False

    async def search_contacts(self, query: str) -> list[Contact]:
        from app.matching import rank_contacts

        return rank_contacts(self.contacts, query)

    async def send_message(self, contact_id: int, text: str) -> None:
        if self.fail:
            raise RuntimeError("boom")
        self.sent.append((contact_id, text))


def tool_use(*calls: tuple[str, str, dict[str, Any]], text: str = "") -> LLMResponse:
    content: list[dict[str, Any]] = []
    if text:
        content.append({"type": "text", "text": text})
    tcs = []
    for cid, name, args in calls:
        tcs.append(ToolCall(cid, name, args))
        content.append({"type": "tool_use", "id": cid, "name": name, "input": args})
    return LLMResponse("tool_use", text, tcs, content)


def final(text: str) -> LLMResponse:
    return LLMResponse("end_turn", text, [], [{"type": "text", "text": text}])


async def asgi_request(
    app, method: str, path: str, body: Any = None, token: str | None = None, raw: bytes | None = None
) -> tuple[int, Any]:
    payload = raw if raw is not None else (json.dumps(body).encode() if body is not None else b"")
    headers = [(b"content-type", b"application/json")]
    if token is not None:
        headers.append((b"authorization", f"Bearer {token}".encode()))
    scope = {
        "type": "http",
        "asgi": {"version": "3.0"},
        "http_version": "1.1",
        "method": method,
        "path": path,
        "raw_path": path.encode(),
        "query_string": b"",
        "headers": headers,
        "client": ("test", 1),
        "server": ("test", 80),
        "scheme": "http",
    }
    sent = False

    async def receive():
        nonlocal sent
        if not sent:
            sent = True
            return {"type": "http.request", "body": payload, "more_body": False}
        return {"type": "http.disconnect"}

    status = 0
    chunks: list[bytes] = []

    async def send(message):
        nonlocal status
        if message["type"] == "http.response.start":
            status = message["status"]
        elif message["type"] == "http.response.body":
            chunks.append(message.get("body", b""))

    await app(scope, receive, send)
    data = b"".join(chunks)
    return status, (json.loads(data) if data else None)
