# Developer: @yfeeeee
from __future__ import annotations

import hmac
from contextlib import asynccontextmanager
from typing import Any

from starlette.applications import Starlette
from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.routing import Route

from .agent import Agent

MAX_TEXT = 1000


def create_app(agent: Agent, token: str, gateways: tuple[Any, ...] = ()) -> Starlette:
    """gateways — объекты с async start()/stop(), которые поднимаются вместе с приложением."""

    def authorized(request: Request) -> bool:
        header = request.headers.get("authorization", "")
        prefix = "Bearer "
        if not header.startswith(prefix):
            return False
        return hmac.compare_digest(header[len(prefix) :].encode(), token.encode())

    async def read_json(request: Request) -> dict[str, Any] | None:
        try:
            data = await request.json()
        except Exception:  # noqa: BLE001
            return None
        return data if isinstance(data, dict) else None

    async def health(_: Request) -> JSONResponse:
        return JSONResponse({"ok": True})

    async def command(request: Request) -> JSONResponse:
        if not authorized(request):
            return JSONResponse({"error": "unauthorized"}, status_code=401)
        data = await read_json(request)
        text = data.get("text") if data else None
        if not isinstance(text, str) or not text.strip():
            return JSONResponse({"error": "text required"}, status_code=400)
        return JSONResponse(await agent.handle(text.strip()[:MAX_TEXT]))

    async def confirm(request: Request) -> JSONResponse:
        if not authorized(request):
            return JSONResponse({"error": "unauthorized"}, status_code=401)
        data = await read_json(request)
        pid = data.get("id") if data else None
        approve = data.get("approve") if data else None
        if not isinstance(pid, str) or not isinstance(approve, bool):
            return JSONResponse({"error": "id and approve required"}, status_code=400)
        return JSONResponse(await agent.confirm(pid, approve))

    @asynccontextmanager
    async def lifespan(_: Starlette):
        for g in gateways:
            await g.start()
        try:
            yield
        finally:
            for g in gateways:
                await g.stop()

    return Starlette(
        routes=[
            Route("/health", health, methods=["GET"]),
            Route("/command", command, methods=["POST"]),
            Route("/confirm", confirm, methods=["POST"]),
        ],
        lifespan=lifespan,
    )


def build_from_env() -> Starlette:
    from .config import Settings
    from .llm import AnthropicLLM
    from .telegram_client import TelethonGateway

    s = Settings.from_env()
    telegram = TelethonGateway(s.tg_api_id, s.tg_api_hash, s.tg_session)
    agent = Agent(AnthropicLLM(s.anthropic_key, s.model), telegram)
    return create_app(agent, s.token, gateways=(telegram,))
