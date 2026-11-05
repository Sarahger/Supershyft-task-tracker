"""Task analytics for the Reports overview graphs. Does not score KRA/KPI."""

from __future__ import annotations

from datetime import date, timedelta

from sqlalchemy.orm import Session, joinedload

from app.models import Department, EmployeeEvaluation, Task, User
from app.utils.week_periods import as_local_date, monday_of

CANCELLED = "cancelled"
COMPLETED = "completed"


def _month_end(day: date) -> date:
    if day.month == 12:
        return date(day.year, 12, 31)
    return date(day.year, day.month + 1, 1) - timedelta(days=1)


def _buckets(start: date, end: date) -> list[tuple[date, date]]:
    span = (end - start).days
    buckets: list[tuple[date, date]] = []
    if span <= 10:
        cursor = start
        while cursor <= end:
            buckets.append((cursor, cursor))
            cursor += timedelta(days=1)
        return buckets
    if span <= 45:
        cursor = start
        while cursor <= end:
            week_end = min(monday_of(cursor) + timedelta(days=6), end)
            buckets.append((cursor, week_end))
            cursor = week_end + timedelta(days=1)
        return buckets
    cursor = start
    while cursor <= end:
        month_end = min(_month_end(cursor), end)
        buckets.append((cursor, month_end))
        cursor = month_end + timedelta(days=1)
    return buckets


def _in_bucket(day: date | None, start: date, end: date) -> bool:
    return bool(day and start <= day <= end)


def _department_filter(query, department_id: int | None):
    if department_id is None:
        return query
    return query.filter(Task.departments.any(Department.id == department_id))


def _load_tasks(db: Session, department_id: int | None) -> list[Task]:
    query = db.query(Task).filter(Task.is_archived.is_(False))
    rows = _department_filter(query, department_id).all()
    return list({row.id: row for row in rows}.values())


def _rate(numerator: int, denominator: int) -> float | None:
    if denominator <= 0:
        return None
    return round((numerator / denominator) * 100, 1)


def _completion_trend(tasks: list[Task], start: date, end: date) -> list[dict]:
    points = []
    for bucket_start, bucket_end in _buckets(start, end):
        due = 0
        completed = 0
        for task in tasks:
            if task.status == CANCELLED:
                continue
            due_day = as_local_date(task.due_date)
            if not _in_bucket(due_day, bucket_start, bucket_end):
                continue
            due += 1
            completed_day = as_local_date(task.completed_at) if task.status == COMPLETED else None
            if completed_day and completed_day <= bucket_end:
                completed += 1
        points.append(
            {
                "start": bucket_start.isoformat(),
                "end": bucket_end.isoformat(),
                "due": due,
                "completed": completed,
                "rate": _rate(completed, due),
            }
        )
    return points


def _status_counts(tasks: list[Task]) -> list[dict]:
    counts: dict[str, int] = {}
    for task in tasks:
        counts[task.status] = counts.get(task.status, 0) + 1
    return [
        {"status": status, "count": count}
        for status, count in sorted(counts.items(), key=lambda item: (-item[1], item[0]))
        if count > 0
    ]


def _top_performers(db: Session, start: date, end: date, department_id: int | None) -> list[dict]:
    rows = (
        db.query(EmployeeEvaluation)
        .options(joinedload(EmployeeEvaluation.employee).joinedload(User.departments))
        .filter(EmployeeEvaluation.status == "submitted")
        .all()
    )
    latest: dict[int, EmployeeEvaluation] = {}
    for row in rows:
        month_end = _month_end(row.period_start)
        if row.period_start > end or month_end < start:
            continue
        employee = row.employee
        if employee is None or employee.status != "active":
            continue
        if department_id is not None and not any(d.id == department_id for d in (employee.departments or [])):
            continue
        current = latest.get(row.user_id)
        if current is None or row.period_start > current.period_start:
            latest[row.user_id] = row
    ranked = []
    for row in latest.values():
        employee = row.employee
        ranked.append(
            {
                "user_id": row.user_id,
                "evaluation_id": row.id,
                "name": employee.full_name if employee else "Unknown",
                "score": row.overall_score,
                "period_start": row.period_start.isoformat(),
            }
        )
    ranked.sort(key=lambda item: (-(item["score"] or 0), item["name"]))
    return ranked


def build_analytics(
    db: Session,
    start: date,
    end: date,
    department_id: int | None = None,
) -> dict:
    if end < start:
        start, end = end, start
    tasks = _load_tasks(db, department_id)
    return {
        "start_date": start.isoformat(),
        "end_date": end.isoformat(),
        "completion_trend": _completion_trend(tasks, start, end),
        "by_status": _status_counts(tasks),
        "top_performers": _top_performers(db, start, end, department_id),
    }
