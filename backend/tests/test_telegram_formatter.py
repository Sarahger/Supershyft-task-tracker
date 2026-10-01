"""Telegram command parsing smoke tests (no Telegram network)."""

from app.services.telegram_formatter import format_help, format_task_list


def test_format_help_mentions_link():
    text = format_help("supershyftbot")
    assert "/link" in text
    assert "/today" in text
    assert "/w1" in text
    assert "/attendance" in text
    assert "/dailyupdates" in text


def test_format_empty_list():
    text = format_task_list("Today — Test", [])
    assert "No tasks found" in text


def test_format_attendance_day_empty_people():
    from datetime import date

    from app.services.telegram_formatter import format_attendance_day

    text = format_attendance_day(
        {
            "date": date(2026, 10, 1),
            "stats": {
                "present_wfo": 1,
                "wfh": 0,
                "on_leave": 0,
                "half_day": 0,
                "camp": 0,
                "not_marked": 0,
                "people": {
                    "present_wfo": [{"first_name": "Sara", "last_name": "H"}],
                    "wfh": [],
                    "on_leave": [],
                    "half_day": [],
                    "camp": [],
                    "not_marked": [],
                },
            },
        }
    )
    assert "Attendance — 01-10-26" in text
    assert "Sara H" in text
