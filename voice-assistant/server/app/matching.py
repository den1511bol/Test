# Developer: @yfeeeee
"""Нечёткий поиск контактов по имени, сказанному голосом ("Ане", "Алексею")."""
from __future__ import annotations

from dataclasses import dataclass
from difflib import SequenceMatcher


@dataclass(frozen=True)
class Contact:
    id: int
    name: str


def _score_word(query: str, word: str) -> float:
    if query == word:
        return 1.0
    # Русские падежи: "ане" ~ "аня", "алексею" ~ "алексей" -> сравниваем основу.
    stem = min(len(query), len(word)) - 1
    if stem >= 2 and query[:stem] == word[:stem]:
        return 0.9
    if len(query) >= 3 and (query in word or word in query):
        return 0.85
    return SequenceMatcher(None, query, word).ratio()


def score(query: str, name: str) -> float:
    q = query.strip().lower()
    n = name.strip().lower()
    if not q or not n:
        return 0.0
    if q == n:
        return 1.0
    best = _score_word(q, n)
    for word in n.split():
        best = max(best, _score_word(q, word))
    # Запрос из нескольких слов ("Иван Петров"): сравниваем целиком.
    if " " in q:
        best = max(best, SequenceMatcher(None, q, n).ratio())
    return best


def rank_contacts(
    contacts: list[Contact], query: str, threshold: float = 0.6, limit: int = 3
) -> list[Contact]:
    scored = [(score(query, c.name), c) for c in contacts]
    scored = [s for s in scored if s[0] >= threshold]
    scored.sort(key=lambda s: (-s[0], s[1].name))
    return [c for _, c in scored[:limit]]
