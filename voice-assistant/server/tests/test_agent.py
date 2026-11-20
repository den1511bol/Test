# Developer: @yfeeeee
import asyncio

from app.agent import Agent
from app.matching import Contact, rank_contacts
from app.pending import PendingStore

from helpers import FakeLLM, FakeTelegram, final, tool_use

ANYA = Contact(101, "Аня Иванова")
ALEX = Contact(102, "Алексей")
CONTACTS = [ANYA, ALEX, Contact(103, "Мама")]


def run(coro):
    return asyncio.run(coro)


def make(script, contacts=CONTACTS, clock=None):
    llm, tg = FakeLLM(script), FakeTelegram(contacts)
    kwargs = {"clock": clock} if clock else {}
    return Agent(llm, tg, PendingStore(), **kwargs), llm, tg


def test_play_music_returns_client_action():
    agent, _, _ = make(
        [tool_use(("t1", "play_music", {"query": "Кино Группа крови"})), final("Включаю.")]
    )
    res = run(agent.handle("включи группу крови"))
    assert res["actions"] == [{"type": "play_music", "query": "Кино Группа крови"}]
    assert res["reply"] == "Включаю."
    assert res["confirm"] is None and res["listen_again"] is False


def test_timer_and_alarm_validated():
    agent, llm, _ = make(
        [
            tool_use(
                ("a", "set_timer", {"seconds": 600, "label": "чай"}),
                ("b", "set_timer", {"seconds": 999999}),
                ("c", "set_alarm", {"hour": 25, "minute": 0}),
                ("d", "set_alarm", {"hour": 7, "minute": 30, "label": "встать"}),
            ),
            final("Готово."),
        ]
    )
    res = run(agent.handle("таймеры"))
    assert res["actions"] == [
        {"type": "set_timer", "seconds": 600, "label": "чай"},
        {"type": "set_alarm", "hour": 7, "minute": 30, "label": "встать"},
    ]
    results = llm.calls[1][-1]["content"]
    assert "Допустимы" in results[1]["content"] and "Некорректное" in results[2]["content"]


def test_telegram_requires_confirmation_and_sends_only_on_yes():
    agent, _, tg = make(
        [
            tool_use(("f", "find_contact", {"name": "Ане"})),
            tool_use(("s", "send_telegram", {"contact_id": 101, "text": "Привет, я скоро буду"})),
        ]
    )
    res = run(agent.handle("напиши Ане что я скоро буду"))
    assert tg.sent == []  # до подтверждения ничего не отправлено
    assert res["confirm"] and "Аня Иванова" in res["reply"] and "Привет, я скоро буду" in res["reply"]
    out = run(agent.confirm(res["confirm"]["id"], True))
    assert tg.sent == [(101, "Привет, я скоро буду")]
    assert "Отправил" in out["reply"]
    # повторное подтверждение того же id не отправляет второй раз
    assert "устарело" in run(agent.confirm(res["confirm"]["id"], True))["reply"]
    assert len(tg.sent) == 1


def test_decline_does_not_send():
    agent, _, tg = make(
        [
            tool_use(("f", "find_contact", {"name": "Мама"})),
            tool_use(("s", "send_telegram", {"contact_id": 103, "text": "Привет"})),
        ]
    )
    res = run(agent.handle("напиши маме привет"))
    assert run(agent.confirm(res["confirm"]["id"], False))["reply"] == "Отменил."
    assert tg.sent == []


def test_send_failure_reported():
    agent, _, tg = make(
        [
            tool_use(("f", "find_contact", {"name": "Мама"})),
            tool_use(("s", "send_telegram", {"contact_id": 103, "text": "Привет"})),
        ]
    )
    res = run(agent.handle("напиши маме привет"))
    tg.fail = True
    assert "Не удалось" in run(agent.confirm(res["confirm"]["id"], True))["reply"]


def test_cannot_send_to_contact_not_found_in_this_run():
    agent, llm, tg = make(
        [
            tool_use(("s", "send_telegram", {"contact_id": 101, "text": "Привет"})),
            final("Не нашёл."),
        ]
    )
    res = run(agent.handle("напиши Ане"))
    assert res["confirm"] is None and tg.sent == []
    assert "find_contact" in llm.calls[1][-1]["content"][0]["content"]


def test_pending_expires():
    now = [0.0]
    store = PendingStore(ttl=10, clock=lambda: now[0])
    pid = store.add(1, "X", "t")
    now[0] = 11
    assert store.pop(pid) is None


def test_ask_user_keeps_short_context_for_followup():
    now = [0.0]
    agent, llm, _ = make(
        [
            tool_use(("q", "ask_user", {"question": "Какой Ане: Ивановой или Петровой?"})),
            final("Ок."),
        ],
        clock=lambda: now[0],
    )
    first = run(agent.handle("напиши Ане привет"))
    assert first["listen_again"] is True and first["reply"].startswith("Какой Ане")
    run(agent.handle("Ивановой"))
    followup = llm.calls[1]
    assert followup[0]["content"] == "напиши Ане привет"
    assert followup[1]["role"] == "assistant" and followup[-1]["content"] == "Ивановой"

    # через время контекст забывается
    agent2, llm2, _ = make(
        [tool_use(("q", "ask_user", {"question": "Кому?"})), final("Ок.")], clock=lambda: now[0]
    )
    run(agent2.handle("напиши"))
    now[0] = 1000
    run(agent2.handle("Ане"))
    assert len(llm2.calls[1]) == 1


def test_tool_loop_is_bounded():
    agent, _, _ = make([tool_use((f"t{i}", "play_music", {"query": "x"})) for i in range(20)])
    assert "Не получилось" in run(agent.handle("зациклись"))["reply"]


def test_unknown_tool_and_tool_exception_do_not_crash():
    agent, llm, tg = make(
        [tool_use(("u", "launch_rocket", {}), ("f", "find_contact", {"name": "Аня"})), final("Ок.")]
    )

    async def boom(_q):
        raise RuntimeError("tg down")

    tg.search_contacts = boom
    assert run(agent.handle("x"))["reply"] == "Ок."
    results = llm.calls[1][-1]["content"]
    assert "Неизвестный" in results[0]["content"] and "Ошибка" in results[1]["content"]


def test_contact_matching_handles_russian_cases():
    contacts = [ANYA, ALEX, Contact(104, "Анна Петрова"), Contact(103, "Мама")]
    assert rank_contacts(contacts, "Алексею")[0] == ALEX
    assert rank_contacts(contacts, "маме")[0].name == "Мама"
    assert rank_contacts(contacts, "Ане")[0].name in {"Аня Иванова", "Анна Петрова"}
    assert rank_contacts(contacts, "Вячеслав") == []
