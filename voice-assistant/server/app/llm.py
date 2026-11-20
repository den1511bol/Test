# Developer: @yfeeeee
from __future__ import annotations

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
