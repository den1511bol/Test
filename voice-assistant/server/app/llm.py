# Developer: @yfeeeee
from __future__ import annotations

import asyncio
import json
from dataclasses import dataclass, field
from typing import Any, Protocol


@dataclass
class ToolCall:
    id: str
    name: str
    input: dict[str, Any]


@dataclass
class LLMResponse:
    stop_reason: str
    text: str
    tool_calls: list[ToolCall] = field(default_factory=list)
    # Блоки ответа ассистента в формате Messages API (для возврата в историю).
    content: list[dict[str, Any]] = field(default_factory=list)


class LLMError(RuntimeError):
    """Сбой провайдера ИИ. user_message можно озвучить пользователю."""

    def __init__(self, message: str, user_message: str = "Не получилось обработать команду, попробуй ещё раз.") -> None:
        super().__init__(message)
        self.user_message = user_message


class LLM(Protocol):
    async def complete(
        self, system: str, messages: list[dict[str, Any]], tools: list[dict[str, Any]]
    ) -> LLMResponse: ...


class AnthropicLLM:
    def __init__(self, api_key: str, model: str) -> None:
        from anthropic import AsyncAnthropic  # импорт здесь, чтобы тесты не требовали пакет

        self._client = AsyncAnthropic(api_key=api_key)
        self._model = model

    async def complete(
        self, system: str, messages: list[dict[str, Any]], tools: list[dict[str, Any]]
    ) -> LLMResponse:
        resp = await self._client.messages.create(
            model=self._model,
            max_tokens=1024,
            system=system,
            tools=tools,
            messages=messages,
        )
        content: list[dict[str, Any]] = []
        texts: list[str] = []
        calls: list[ToolCall] = []
        for block in resp.content:
            if block.type == "text":
                texts.append(block.text)
                content.append({"type": "text", "text": block.text})
            elif block.type == "tool_use":
                calls.append(ToolCall(block.id, block.name, dict(block.input)))
                content.append(
                    {
                        "type": "tool_use",
                        "id": block.id,
                        "name": block.name,
                        "input": dict(block.input),
                    }
                )
        return LLMResponse(
            stop_reason=resp.stop_reason or "end_turn",
            text="".join(texts).strip(),
            tool_calls=calls,
            content=content,
        )


def to_openai_tools(tools: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [
        {
            "type": "function",
            "function": {
                "name": t["name"],
                "description": t.get("description", ""),
                "parameters": t["input_schema"],
            },
        }
        for t in tools
    ]


def to_openai_messages(system: str, messages: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Переводит историю из формата Anthropic (блоки tool_use/tool_result) в формат OpenAI Chat."""
    out: list[dict[str, Any]] = [{"role": "system", "content": system}]
    for message in messages:
        role, content = message["role"], message["content"]
        if isinstance(content, str):
            out.append({"role": role, "content": content})
            continue
        if role == "assistant":
            text = "".join(b.get("text", "") for b in content if b.get("type") == "text")
            calls = [
                {
                    "id": b["id"],
                    "type": "function",
                    "function": {
                        "name": b["name"],
                        "arguments": json.dumps(b.get("input", {}), ensure_ascii=False),
                    },
                }
                for b in content
                if b.get("type") == "tool_use"
            ]
            item: dict[str, Any] = {"role": "assistant"}
            if text:
                item["content"] = text
            if calls:
                # Некоторые провайдеры (Gemini) кладут служебные данные рассуждений в extra_content
                # и ждут их обратно вместе с историей вызовов.
                for call, block in zip(
                    calls, [b for b in content if b.get("type") == "tool_use"]
                ):
                    if block.get("extra_content"):
                        call["extra_content"] = block["extra_content"]
                item["tool_calls"] = calls
            out.append(item)
        else:
            for b in content:
                if b.get("type") == "tool_result":
                    out.append(
                        {"role": "tool", "tool_call_id": b["tool_use_id"], "content": str(b.get("content", ""))}
                    )
                elif b.get("type") == "text":
                    out.append({"role": "user", "content": b.get("text", "")})
    return out


class OpenAICompatLLM:
    """Провайдеры с OpenAI-совместимым API (Groq, Gemini, OpenRouter и др.). Работает через httpx."""

    def __init__(
        self,
        api_key: str,
        model: str,
        base_url: str = "https://api.groq.com/openai/v1",
        http: Any = None,
        retry_delay: float = 1.0,
    ) -> None:
        self._api_key = api_key
        self._model = model
        self._url = base_url.rstrip("/") + "/chat/completions"
        self._http = http
        self._retry_delay = retry_delay

    async def complete(
        self, system: str, messages: list[dict[str, Any]], tools: list[dict[str, Any]]
    ) -> LLMResponse:
        if self._http is None:
            import httpx

            self._http = httpx.AsyncClient(timeout=40)
        payload = {
            "model": self._model,
            "messages": to_openai_messages(system, messages),
            "tools": to_openai_tools(tools),
            "tool_choice": "auto",
            "temperature": 0.2,
            "max_tokens": 2048,  # запас: у «думающих» моделей рассуждения тоже считаются
        }
        headers = {"Authorization": f"Bearer {self._api_key}"}

        data: dict[str, Any] | None = None
        for attempt in (1, 2):
            response = await self._http.post(self._url, json=payload, headers=headers)
            status = response.status_code
            if status == 200:
                data = response.json()
                break
            if status == 429:
                raise LLMError("rate limit (429)", "Достигнут лимит бесплатного тарифа, подожди минуту.")
            if status in (401, 403):
                raise LLMError(f"auth error ({status})", "Ключ ИИ-сервиса не принят, проверь настройки сервера.")
            # 5xx и «tool_use_failed» (модель криво сформировала вызов) — повторяем один раз.
            transient = status >= 500 or "tool_use_failed" in response.text
            if attempt == 1 and transient:
                await asyncio.sleep(self._retry_delay)
                continue
            raise LLMError(f"provider error ({status})")
        assert data is not None
        return self._parse(data)

    @staticmethod
    def _parse(data: dict[str, Any]) -> LLMResponse:
        try:
            message = data["choices"][0]["message"]
        except (KeyError, IndexError, TypeError):
            raise LLMError("unexpected response shape") from None
        text = (message.get("content") or "").strip()
        content: list[dict[str, Any]] = []
        if text:
            content.append({"type": "text", "text": text})
        calls: list[ToolCall] = []
        for index, raw in enumerate(message.get("tool_calls") or []):
            function = raw.get("function") or {}
            try:
                args = json.loads(function.get("arguments") or "{}")
            except ValueError:
                args = {}
            if not isinstance(args, dict):
                args = {}
            # Gemini иногда возвращает пустой id: подставляем свой, чтобы сопоставить результаты.
            call = ToolCall(str(raw.get("id") or f"call_{index}"), str(function.get("name", "")), args)
            calls.append(call)
            block: dict[str, Any] = {"type": "tool_use", "id": call.id, "name": call.name, "input": args}
            if raw.get("extra_content"):
                block["extra_content"] = raw["extra_content"]
            content.append(block)
        return LLMResponse("tool_use" if calls else "end_turn", text, calls, content)
