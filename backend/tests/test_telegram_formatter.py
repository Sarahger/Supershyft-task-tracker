"""Telegram command parsing smoke tests (no Telegram network)."""

from app.services.telegram_formatter import format_help, format_task_list


def test_format_help_mentions_link():
    text = format_help("supershyftbot")
    assert "/link" in text
    assert "/today" in text
    assert "/w1" in text


def test_format_empty_list():
    text = format_task_list("Today — Test", [])
    assert "No tasks found" in text
