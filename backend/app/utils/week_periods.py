"""Monday-based weekly reporting periods in the company timezone."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, time, timedelta

from app.utils.month_weeks import get_app_timezone

EDIT_CUTOFF = time(14, 0)
RESOLVED_STATUSES = frozenset({"completed", "cancelled"})


@dataclass(frozen=True)
class WeekPeriod:
    period_start: date
    period_end: date
    planning_start: date
    planning_end: date


def now_local(now: datetime | None = None) -> datetime:
    zone = get_app_timezone()
    if now is None:
        return datetime.now(zone)
    if now.tzinfo is None:
        return now.replace(tzinfo=zone)
    return now.astimezone(zone)


def today_local(now: datetime | None = None) -> date:
    return now_local(now).date()


def monday_of(day: date) -> date:
    return day - timedelta(days=day.weekday())


def saturday_of(monday: date) -> date:
    return monday + timedelta(days=5)


def next_monday(monday: date) -> date:
    return monday + timedelta(days=7)


def planning_window(period_start: date) -> tuple[date, date]:
    start = next_monday(period_start)
    return start, start + timedelta(days=6)


def period_end_for_submit(period_start: date, submit_date: date) -> date:
    saturday = saturday_of(period_start)
    if submit_date < period_start:
        return period_start
    if submit_date <= saturday:
        return submit_date
    return saturday


def resolve_period(period_start: date | None = None, now: datetime | None = None) -> WeekPeriod:
    start = monday_of(period_start) if period_start is not None else monday_of(today_local(now))
    if period_start is not None and period_start != start:
        raise ValueError("period_start must be a Monday")
    submit_day = today_local(now)
    period_end = period_end_for_submit(start, submit_day)
    plan_start, plan_end = planning_window(start)
    return WeekPeriod(
        period_start=start,
        period_end=period_end,
        planning_start=plan_start,
        planning_end=plan_end,
    )


def current_week_start(now: datetime | None = None) -> date:
    return monday_of(today_local(now))


def previous_period_start(period_start: date) -> date:
    return period_start - timedelta(days=7)


def editable_until_for(period_start: date) -> datetime:
    """Last week stays open until 2:00 PM on the following Monday."""
    zone = get_app_timezone()
    return datetime.combine(next_monday(period_start), EDIT_CUTOFF, tzinfo=zone)


def period_unlocks_at(period_start: date) -> datetime:
    """A week can start only after the previous week locks at Monday 2:00 PM."""
    return editable_until_for(previous_period_start(period_start))


def is_report_editable(period_start: date, status: str, now: datetime | None = None) -> bool:
    current = now_local(now)
    return period_unlocks_at(period_start) <= current < editable_until_for(period_start)


def writable_period_start(now: datetime | None = None) -> date:
    current = now_local(now)
    this_monday = monday_of(current.date())
    last_monday = previous_period_start(this_monday)
    if current < editable_until_for(last_monday):
        return last_monday
    return this_monday


def report_edit_block_reason(period_start: date, now: datetime | None = None) -> str | None:
    current = now_local(now)
    if current < period_unlocks_at(period_start):
        return "This week's update opens at 2:00 PM Monday, after last week's update is locked"
    if current >= editable_until_for(period_start):
        return "This weekly update can only be edited until 2:00 PM on the following Monday"
    return None


def local_day_bounds(day: date) -> tuple[datetime, datetime]:
    zone = get_app_timezone()
    start = datetime.combine(day, time.min, tzinfo=zone)
    end = datetime.combine(day + timedelta(days=1), time.min, tzinfo=zone)
    return start, end


def period_datetime_bounds(period_start: date, period_end: date) -> tuple[datetime, datetime]:
    start, _ = local_day_bounds(period_start)
    _, end = local_day_bounds(period_end)
    return start, end


def week_datetime_bounds(period_start: date) -> tuple[datetime, datetime]:
    """Monday 00:00 through next Monday 00:00 in the company timezone."""
    start, _ = local_day_bounds(period_start)
    end, _ = local_day_bounds(next_monday(period_start))
    return start, end


def is_auto_sync_open(period_start: date, now: datetime | None = None) -> bool:
    return is_report_editable(period_start, "draft", now)


def due_at_noon(day: date) -> datetime:
    return datetime.combine(day, time(12, 0), tzinfo=get_app_timezone())


def as_local_date(value: datetime | date | None) -> date | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        if value.tzinfo is None:
            value = value.replace(tzinfo=get_app_timezone())
        return value.astimezone(get_app_timezone()).date()
    return value
