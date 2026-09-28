"""Unit tests for month-week and today bounds used by Telegram /w1–/w4."""

from datetime import datetime
from zoneinfo import ZoneInfo

from app.utils.month_weeks import month_week_bounds, today_bounds

IST = ZoneInfo("Asia/Kolkata")


def test_week1_january():
    now = datetime(2026, 1, 15, 12, 0, tzinfo=IST)
    start, end = month_week_bounds(1, now=now, tz=IST)
    assert start.astimezone(IST).day == 1
    assert end.astimezone(IST).day == 8  # exclusive next day after 7


def test_week4_ends_on_month_last_day():
    now = datetime(2026, 2, 10, 9, 0, tzinfo=IST)
    start, end = month_week_bounds(4, now=now, tz=IST)
    assert start.astimezone(IST).day == 22
    # Feb 2026 has 28 days → exclusive end is March 1
    local_end = end.astimezone(IST)
    assert local_end.month == 3 and local_end.day == 1


def test_week4_31_day_month():
    now = datetime(2026, 3, 5, 9, 0, tzinfo=IST)
    start, end = month_week_bounds(4, now=now, tz=IST)
    assert start.astimezone(IST).day == 22
    local_end = end.astimezone(IST)
    assert local_end.month == 4 and local_end.day == 1


def test_invalid_week_raises():
    try:
        month_week_bounds(5)
        assert False, "expected ValueError"
    except ValueError:
        pass


def test_today_bounds_ist():
    now = datetime(2026, 9, 28, 18, 30, tzinfo=IST)
    start, end = today_bounds(now=now, tz=IST)
    assert start.astimezone(IST).hour == 0
    assert (end - start).total_seconds() == 24 * 3600
