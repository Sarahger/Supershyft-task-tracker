from app.services.telegram_formatter import format_help, format_task_list


def test_format_help_mentions_link():
    text = format_help("supershyftbot")
    assert "/link" in text
    assert "/today" in text
    assert "/today all" in text
    assert "/w1" in text
    assert "/attendance" in text
    assert "/dailyupdates" in text
    assert "/summary" not in text
    assert "AI" not in text


def test_format_empty_list():
    text = format_task_list("Today · Test", [])
    assert "No tasks found" in text


def test_format_task_table_has_pre():
    from types import SimpleNamespace
    from datetime import datetime, timezone

    from app.services.telegram_formatter import format_task_table

    task = SimpleNamespace(
        id=1,
        title="Build dashboard screen",
        status="to_do",
        due_date=datetime(2026, 10, 1, 12, 0, tzinfo=timezone.utc),
        estimated_hours=2.5,
        assignees=[],
    )
    text = format_task_table("Today · Test", [task], show_assignee=False)
    assert "<pre>" in text
    assert "Status" in text
    assert "Build dashboard" in text or "Build dashboard screen" in text


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
    assert "01-10-26" in text
    assert "Sara H" in text
    assert "WFO" in text
