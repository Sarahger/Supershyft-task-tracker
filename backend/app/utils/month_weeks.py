"""Month-week helpers for Telegram /w1–/w4 (weeks of the current month)."""

from __future__ import annotations

from calendar import monthrange
from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

from app.core.config import settings


def get_app_timezone() -> ZoneInfo:
    return ZoneInfo(settings.MEETING_TIMEZONE or "Asia/Kolkata")


def month_week_bounds(
    week: int,
    *,
    now: datetime | None = None,
    tz: ZoneInfo | None = None,
) -> tuple[datetime, datetime]:
    """
    Return UTC-aware [start, end) bounds for week N of the current month.

    Week 1: days 1–7
    Week 2: days 8–14
    Week 3: days 15–21
    Week 4: days 22–last day of month
    """
    if week not in (1, 2, 3, 4):
        raise ValueError("week must be 1–4")

    zone = tz or get_app_timezone()
    if now is None:
        local_now = datetime.now(zone)
    elif now.tzinfo is None:
        local_now = now.replace(tzinfo=zone)
    else:
        local_now = now.astimezone(zone)

    year, month = local_now.year, local_now.month
    last_day = monthrange(year, month)[1]

    if week == 1:
        start_day, end_day = 1, 7
    elif week == 2:
        start_day, end_day = 8, 14
    elif week == 3:
        start_day, end_day = 15, 21
    else:
        start_day, end_day = 22, last_day

    end_day = min(end_day, last_day)
    start_local = datetime(year, month, start_day, 0, 0, 0, tzinfo=zone)
    end_exclusive = datetime(year, month, end_day, 0, 0, 0, tzinfo=zone) + timedelta(days=1)
    return start_local.astimezone(ZoneInfo("UTC")), end_exclusive.astimezone(ZoneInfo("UTC"))


def today_bounds(*, now: datetime | None = None, tz: ZoneInfo | None = None) -> tuple[datetime, datetime]:
    """Return UTC [start, end) for 'today' in the app timezone."""
    zone = tz or get_app_timezone()
    if now is None:
        local_now = datetime.now(zone)
    elif now.tzinfo is None:
        local_now = now.replace(tzinfo=zone)
    else:
        local_now = now.astimezone(zone)

    start_local = datetime.combine(local_now.date(), time.min, tzinfo=zone)
    end_local = start_local + timedelta(days=1)
    return start_local.astimezone(ZoneInfo("UTC")), end_local.astimezone(ZoneInfo("UTC"))
