# Developer: @yfeeeee
from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Any, Callable

from .llm import LLM, ToolCall
from .pending import PendingStore
from .telegram_client import TelegramGateway

MAX_STEPS = 6
HISTORY_TTL = 90.0

SYSTEM = (
    "Ты — личный голосовой помощник на телефоне Android. Отвечай по-русски, очень коротко "
    "(1–2 фразы): ответ будет озвучен. Используй инструменты для действий.\n"
    "Правила:\n"
    "- Музыка: play_music с запросом (исполнитель, трек или жанр). Запускается в YouTube Music.\n"
    "- Таймеры и напоминания через время: set_timer (секунды) с понятным label. "
    "Напоминание на конкретное время: set_alarm.\n"
    "- Сообщение в Telegram: сначала find_contact, затем send_telegram с contact_id из результата. "
    "Текст сообщения пиши от первого лица пользователя, сохраняя смысл и тон сказанного, "
    "ничего не выдумывай. send_telegram НЕ отправляет сразу — пользователь подтвердит голосом, "
    "поэтому никогда не говори, что сообщение уже отправлено.\n"
    "- Если пользователь не сказал, что именно написать, сначала вызови ask_user «Что написать?».\n"
    "- Если контакт не найден или найдено несколько похожих, вызови ask_user, перечислив варианты "
    "по именам («Кому: Аня или Анна?»). Ответ на такое уточнение — это ТОЛЬКО выбор контакта: "
    "никогда не добавляй его слова в текст сообщения и не меняй уже названный текст.\n"
    "- Не выбирай контакт, если имя не совпадает с запросом: лучше спроси.\n"
    "- Если просят что-то, чего ты не умеешь, честно скажи об этом."
)

TOOLS: list[dict[str, Any]] = [
    {
        "name": "play_music",
        "description": "Включить музыку в YouTube Music по поисковому запросу.",
        "input_schema": {
            "type": "object",
            "properties": {"query": {"type": "string", "description": "Что включить"}},
            "required": ["query"],
        },
    },
    {
        "name": "set_timer",
        "description": "Поставить таймер на указанное число секунд.",
        "input_schema": {
            "type": "object",
            "properties": {
                "seconds": {"type": "integer", "minimum": 1, "maximum": 86400},
                "label": {"type": "string", "description": "Название таймера"},
            },
            "required": ["seconds"],
        },
    },
    {
        "name": "set_alarm",
        "description": "Поставить будильник/напоминание на конкретное время (24-часовой формат).",
        "input_schema": {
            "type": "object",
            "properties": {
                "hour": {"type": "integer", "minimum": 0, "maximum": 23},
                "minute": {"type": "integer", "minimum": 0, "maximum": 59},
                "label": {"type": "string"},
            },
            "required": ["hour", "minute"],
        },
    },
    {
        "name": "find_contact",
        "description": "Найти контакт Telegram по имени. Возвращает список кандидатов с id.",
        "input_schema": {
            "type": "object",
            "properties": {"name": {"type": "string"}},
            "required": ["name"],
        },
    },
    {
        "name": "send_telegram",
        "description": (
            "Подготовить сообщение контакту. Отправка произойдёт только после голосового "
            "подтверждения пользователя."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "contact_id": {"type": "integer", "description": "id из find_contact"},
                "text": {"type": "string"},
            },
            "required": ["contact_id", "text"],
        },
    },
    {
        "name": "ask_user",
        "description": "Задать пользователю уточняющий вопрос; ответ придёт следующей командой.",
        "input_schema": {
            "type": "object",
            "properties": {"question": {"type": "string"}},
            "required": ["question"],
        },
    },
]


@dataclass
class _Run:
    actions: list[dict[str, Any]] = field(default_factory=list)
    known_contacts: dict[int, str] = field(default_factory=dict)
    confirm: dict[str, str] | None = None
    ask: str | None = None


class Agent:
    def __init__(
        self,
        llm: LLM,
        telegram: TelegramGateway,
        pending: PendingStore | None = None,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self.llm = llm
        self.telegram = telegram
        self.pending = pending or PendingStore()
        self._clock = clock
        self._history: list[dict[str, Any]] = []
        self._history_expires = 0.0

    async def handle(self, text: str) -> dict[str, Any]:
        run = _Run()
        messages = self._fresh_history() + [{"role": "user", "content": text}]
        self._history = []

        for _ in range(MAX_STEPS):
            resp = await self.llm.complete(SYSTEM, messages, TOOLS)
            if resp.stop_reason != "tool_use" or not resp.tool_calls:
                return self._result(run, resp.text or "Готово.")

            messages.append({"role": "assistant", "content": resp.content})
            results = []
            for call in resp.tool_calls:
                output = await self._execute(call, run)
                results.append({"type": "tool_result", "tool_use_id": call.id, "content": output})
            messages.append({"role": "user", "content": results})

            if run.confirm is not None:
                return self._result(run, run.confirm["summary"])
            if run.ask is not None:
                self._history = [
                    {"role": "user", "content": text},
                    {"role": "assistant", "content": run.ask},
                ]
                self._history_expires = self._clock() + HISTORY_TTL
                return self._result(run, run.ask, listen_again=True)

        return self._result(run, "Не получилось выполнить команду.")

    async def confirm(self, pending_id: str, approve: bool) -> dict[str, Any]:
        item = self.pending.pop(pending_id)
        if item is None:
            return {"reply": "Подтверждение устарело, повтори команду.", "actions": []}
        if not approve:
            return {"reply": "Отменил.", "actions": []}
        try:
            await self.telegram.send_message(item.contact_id, item.text)
        except Exception:  # noqa: BLE001 — пользователю нужен короткий понятный ответ
            return {"reply": "Не удалось отправить сообщение.", "actions": []}
        return {"reply": f"Отправил: {item.contact_name}.", "actions": []}

    # ---- внутреннее ----

    def _fresh_history(self) -> list[dict[str, Any]]:
        if self._history and self._clock() < self._history_expires:
            return list(self._history)
        return []

    @staticmethod
    def _result(run: _Run, reply: str, listen_again: bool = False) -> dict[str, Any]:
        return {
            "reply": reply,
            "actions": run.actions,
            "confirm": {"id": run.confirm["id"], "summary": run.confirm["summary"]}
            if run.confirm
            else None,
            "listen_again": listen_again,
        }

    async def _execute(self, call: ToolCall, run: _Run) -> str:
        try:
            return await self._dispatch(call, run)
        except Exception as exc:  # noqa: BLE001 — ошибку отдаём модели, чтобы она отреагировала
            return f"Ошибка инструмента: {exc}"

    async def _dispatch(self, call: ToolCall, run: _Run) -> str:
        args = call.input
        if call.name == "play_music":
            query = str(args.get("query", "")).strip()
            if not query:
                return "Пустой запрос."
            run.actions.append({"type": "play_music", "query": query})
            return "Музыка будет запущена."

        if call.name == "set_timer":
            seconds = int(args.get("seconds", 0))
            if not 1 <= seconds <= 86400:
                return "Допустимы значения от 1 секунды до 24 часов."
            run.actions.append(
                {"type": "set_timer", "seconds": seconds, "label": str(args.get("label", "")).strip()}
            )
            return "Таймер будет поставлен."

        if call.name == "set_alarm":
            hour, minute = int(args.get("hour", -1)), int(args.get("minute", -1))
            if not (0 <= hour <= 23 and 0 <= minute <= 59):
                return "Некорректное время."
            run.actions.append(
                {
                    "type": "set_alarm",
                    "hour": hour,
                    "minute": minute,
                    "label": str(args.get("label", "")).strip(),
                }
            )
            return "Будильник будет поставлен."

        if call.name == "find_contact":
            found = await self.telegram.search_contacts(str(args.get("name", "")))
            if not found:
                return "Контакты не найдены."
            for c in found:
                run.known_contacts[c.id] = c.name
            return "Найдено: " + "; ".join(f"{c.name} (id={c.id})" for c in found)

        if call.name == "send_telegram":
            contact_id = int(args.get("contact_id", 0))
            text = str(args.get("text", "")).strip()
            if contact_id not in run.known_contacts:
                return "Сначала найди контакт через find_contact и используй его id."
            if not text:
                return "Пустой текст сообщения."
            name = run.known_contacts[contact_id]
            pid = self.pending.add(contact_id, name, text)
            run.confirm = {
                "id": pid,
                "summary": f"Отправить {name}: «{text}»? Скажи да или нет.",
            }
            return "Ожидается голосовое подтверждение пользователя."

        if call.name == "ask_user":
            question = str(args.get("question", "")).strip()
            run.ask = question or "Уточни, пожалуйста."
            return "Вопрос задан пользователю."

        return f"Неизвестный инструмент: {call.name}"
