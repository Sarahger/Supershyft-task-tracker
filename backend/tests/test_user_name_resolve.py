"""Exact first-name matching for Telegram /user lookups."""

from types import SimpleNamespace

from app.services.telegram_task_service import TelegramTaskService


def _match_in_memory(users: list, name: str) -> list:
    """Mirror resolve_users_by_name rules without a DB session."""
    term = (name or "").strip()
    if not term:
        return []
    parts = term.split()
    active = [u for u in users if u.status != "inactive"]
    if len(parts) == 1:
        token = parts[0].lower()
        return [u for u in active if u.first_name.lower() == token]
    first = parts[0].lower()
    last = " ".join(parts[1:]).lower()
    exact = [
        u for u in active if u.first_name.lower() == first and u.last_name.lower() == last
    ]
    if exact:
        return exact
    return [
        u
        for u in active
        if u.first_name.lower() == first and u.last_name.lower().startswith(last)
    ]


def test_single_name_exact_first_only():
    users = [
        SimpleNamespace(first_name="Harsh", last_name="Kumar", status="active"),
        SimpleNamespace(first_name="Harshili", last_name="Patel", status="active"),
        SimpleNamespace(first_name="Sarah", last_name="Admin", status="active"),
    ]
    matches = _match_in_memory(users, "harsh")
    assert len(matches) == 1
    assert matches[0].first_name == "Harsh"


def test_duplicate_first_names_need_surname():
    users = [
        SimpleNamespace(first_name="Harsh", last_name="Kumar", status="active"),
        SimpleNamespace(first_name="Harsh", last_name="Sharma", status="active"),
    ]
    matches = _match_in_memory(users, "harsh")
    assert len(matches) == 2
    narrowed = _match_in_memory(users, "harsh sharma")
    assert len(narrowed) == 1
    assert narrowed[0].last_name == "Sharma"


def test_harshili_exact():
    users = [
        SimpleNamespace(first_name="Harsh", last_name="Kumar", status="active"),
        SimpleNamespace(first_name="Harshili", last_name="Patel", status="active"),
    ]
    matches = _match_in_memory(users, "harshili")
    assert len(matches) == 1
    assert matches[0].first_name == "Harshili"
