from app.services.telegram_task_service import format_estimated_duration


def test_minutes_only_under_one_hour():
    assert format_estimated_duration(0.5) == "30m"
    assert format_estimated_duration(0.25) == "15m"
    assert format_estimated_duration(0.75) == "45m"


def test_whole_hours():
    assert format_estimated_duration(1) == "1h"
    assert format_estimated_duration(2.0) == "2h"


def test_hours_and_minutes():
    assert format_estimated_duration(2.5) == "2h30m"
    assert format_estimated_duration(1.25) == "1h15m"


def test_missing_or_zero():
    assert format_estimated_duration(None) == "time n/a"
    assert format_estimated_duration(0) == "0m"
