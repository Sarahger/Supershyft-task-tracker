"""Task analytics for the Reports overview graphs. Does not score KRA/KPI."""

from __future__ import annotations

from datetime import date, datetime, timedelta

from sqlalchemy.orm import Session, joinedload

from app.core.company_holidays import is_working_day
from app.core.constants import AttendanceStatus
from app.core.datetime_utils import as_utc, utcnow
from app.models import Attendance, Department, EmployeeEvaluation, Task, TaskAssignee, User
from app.utils.week_periods import as_local_date, is_due_date_overdue, monday_of

CANCELLED = "cancelled"
COMPLETED = "completed"
DEFAULT_ANNUAL_LEAVE_DAYS = 12
WORKLOAD_BUCKETS = (
    "pending",
    "in_progress",
    "overdue",
    "blocked",
    "due_this_week",
    "completed",
    "in_review",
    "cancelled",
)


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
    """Rank by monthly average of submitted period scores (latest month in range)."""
    rows = (
        db.query(EmployeeEvaluation)
        .options(joinedload(EmployeeEvaluation.employee).joinedload(User.departments))
        .filter(EmployeeEvaluation.status == "submitted")
        .all()
    )
    # user_id -> month_start -> list of submitted evals
    by_user_month: dict[int, dict[date, list[EmployeeEvaluation]]] = {}
    for row in rows:
        month_start = row.period_start.replace(day=1)
        month_end = _month_end(month_start)
        if month_start > end or month_end < start:
            continue
        employee = row.employee
        if employee is None or employee.status != "active":
            continue
        if department_id is not None and not any(d.id == department_id for d in (employee.departments or [])):
            continue
        if row.overall_score is None:
            continue
        by_user_month.setdefault(row.user_id, {}).setdefault(month_start, []).append(row)

    ranked = []
    for user_id, months in by_user_month.items():
        latest_month = max(months.keys())
        month_rows = months[latest_month]
        avg = round(sum(r.overall_score for r in month_rows) / len(month_rows), 2)
        # Prefer the latest period eval id for deep-link into the Evaluations tab.
        anchor = max(month_rows, key=lambda r: (r.period_start, r.id))
        employee = anchor.employee
        ranked.append(
            {
                "user_id": user_id,
                "evaluation_id": anchor.id,
                "name": employee.full_name if employee else "Unknown",
                "score": avg,
                "period_start": latest_month.isoformat(),
                "period_end": _month_end(latest_month).isoformat(),
                "evaluation_count": len(month_rows),
            }
        )
    ranked.sort(key=lambda item: (-(item["score"] or 0), item["name"]))
    return ranked


def _leave_days_taken(status: str) -> float:
    if status == AttendanceStatus.LEAVE.value:
        return 1.0
    if status == AttendanceStatus.HALF_DAY.value:
        return 0.5
    return 0.0


def _leave_balances(db: Session, department_id: int | None = None) -> list[dict]:
    """Per-person annual leave: assigned, taken through current week, remaining."""
    today = date.today()
    year_start = date(today.year, 1, 1)
    week_end = monday_of(today) + timedelta(days=6)

    users_query = (
        db.query(User)
        .options(joinedload(User.departments))
        .filter(User.status.in_(["active", "on_leave"]))
    )
    users = users_query.all()
    if department_id is not None:
        users = [u for u in users if any(d.id == department_id for d in (u.departments or []))]

    if not users:
        return []

    user_ids = [u.id for u in users]
    rows = (
        db.query(Attendance)
        .filter(
            Attendance.user_id.in_(user_ids),
            Attendance.attendance_date >= year_start,
            Attendance.attendance_date <= week_end,
            Attendance.status.in_([AttendanceStatus.LEAVE.value, AttendanceStatus.HALF_DAY.value]),
        )
        .all()
    )
    taken_by_user: dict[int, float] = {uid: 0.0 for uid in user_ids}
    for row in rows:
        # Designated offs (Sundays, 2nd/4th Saturdays, public holidays) never consume leave balance.
        if not is_working_day(row.attendance_date):
            continue
        taken_by_user[row.user_id] = taken_by_user.get(row.user_id, 0.0) + _leave_days_taken(row.status)

    balances = []
    for user in users:
        assigned = int(getattr(user, "annual_leave_days", None) or DEFAULT_ANNUAL_LEAVE_DAYS)
        taken = round(taken_by_user.get(user.id, 0.0), 1)
        pending = round(max(0.0, assigned - taken), 1)
        balances.append(
            {
                "user_id": user.id,
                "name": user.full_name,
                "departments": [d.name for d in (user.departments or [])],
                "assigned": assigned,
                "taken": taken,
                "pending": pending,
                "year": today.year,
                "through": week_end.isoformat(),
            }
        )
    balances.sort(key=lambda item: (-item["taken"], item["name"]))
    return balances


def _task_matches_bucket(task: Task, bucket: str, now: datetime, week_end: datetime) -> bool:
    is_pending = task.status not in {COMPLETED, CANCELLED}
    if bucket == "pending":
        return is_pending
    if bucket == "in_progress":
        return task.status == "in_progress"
    if bucket == "overdue":
        return bool(is_pending and is_due_date_overdue(task.due_date, status=task.status))
    if bucket == "blocked":
        return task.status == "blocked"
    if bucket == "due_this_week":
        return bool(
            task.due_date
            and is_pending
            and now <= as_utc(task.due_date) <= week_end
        )
    if bucket == "completed":
        return task.status == COMPLETED
    if bucket == "in_review":
        return task.status == "in_review"
    if bucket == "cancelled":
        return task.status == CANCELLED
    return False


def workload_tasks(
    db: Session,
    user_id: int,
    bucket: str,
    department_id: int | None = None,
) -> dict:
    if bucket not in WORKLOAD_BUCKETS:
        raise ValueError(f"Unknown workload bucket: {bucket}")

    user = db.query(User).options(joinedload(User.departments)).filter(User.id == user_id).first()
    if user is None:
        return {"user_id": user_id, "name": "Unknown", "bucket": bucket, "tasks": []}

    query = (
        db.query(Task)
        .join(TaskAssignee)
        .options(joinedload(Task.assignees))
        .filter(Task.is_archived.is_(False), TaskAssignee.user_id == user_id)
    )
    if department_id is not None:
        query = query.filter(Task.departments.any(Department.id == department_id))
    tasks = query.all()

    now = utcnow()
    week_end = now + timedelta(days=7)
    matched = [task for task in tasks if _task_matches_bucket(task, bucket, now, week_end)]
    matched.sort(
        key=lambda task: (
            as_utc(task.due_date) if task.due_date else datetime.max.replace(tzinfo=now.tzinfo),
            task.title or "",
        )
    )
    return {
        "user_id": user.id,
        "name": user.full_name,
        "bucket": bucket,
        "tasks": [
            {
                "id": task.id,
                "title": task.title,
                "status": task.status,
                "due_date": task.due_date.isoformat() if task.due_date else None,
            }
            for task in matched
        ],
    }


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
        "leave_balances": _leave_balances(db, department_id),
        "top_performers": _top_performers(db, start, end, department_id),
    }
