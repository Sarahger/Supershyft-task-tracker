"""Deterministic task queries for Telegram commands (no AI)."""

from __future__ import annotations

from datetime import timedelta

from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.core.constants import UserRole
from app.models import Task, User
from app.repositories.base import TaskRepository
from app.utils.month_weeks import get_app_timezone, month_week_bounds, today_bounds

STATUS_LABELS = {
    "to_do": "To Do",
    "in_progress": "WIP",
    "blocked": "Blocked",
    "in_review": "Review",
    "approved": "Approved",
    "testing": "Testing",
    "bugs_found": "Bugs",
    "completed": "Done",
    "cancelled": "Cancelled",
}


class TelegramTaskService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = TaskRepository(db)

    def is_manager(self, user: User) -> bool:
        return user.role in (UserRole.ADMIN.value, UserRole.MANAGER.value)

    def resolve_users_by_name(self, name: str) -> list[User]:
        term = (name or "").strip()
        if not term:
            return []
        like = f"%{term}%"
        return (
            self.db.query(User)
            .filter(
                User.status != "inactive",
                or_(
                    User.first_name.ilike(like),
                    User.last_name.ilike(like),
                    func.lower(func.concat(User.first_name, " ", User.last_name)).like(like.lower()),
                ),
            )
            .order_by(User.first_name, User.last_name)
            .limit(10)
            .all()
        )

    def _fetch(self, filters: dict, *, limit: int = 25) -> tuple[list[Task], int]:
        return self.repo.get_filtered(skip=0, limit=limit, filters=filters)

    def tasks_today(self, assignee_id: int) -> tuple[list[Task], int]:
        start, end = today_bounds()
        # due_before is inclusive in repo; use just before next midnight
        due_before = end - timedelta(microseconds=1)
        due_today, _ = self._fetch(
            {
                "assignee_id": assignee_id,
                "due_after": start.isoformat(),
                "due_before": due_before.isoformat(),
            }
        )
        due_today = [t for t in due_today if t.status not in ("completed", "cancelled")]

        # Include overdue in-progress (useful like My Tasks today list)
        overdue, _ = self._fetch({"assignee_id": assignee_id, "overdue": True, "status": "in_progress"})
        seen = {t.id for t in due_today}
        combined = list(due_today)
        for t in overdue:
            if t.id not in seen:
                combined.append(t)
                seen.add(t.id)
        return combined, len(combined)

    def tasks_by_status(self, assignee_id: int, status: str) -> tuple[list[Task], int]:
        return self._fetch({"assignee_id": assignee_id, "status": status})

    def tasks_backlog(self, assignee_id: int) -> tuple[list[Task], int]:
        return self._fetch({"assignee_id": assignee_id, "overdue": True})

    def tasks_month_week(self, assignee_id: int, week: int) -> tuple[list[Task], int]:
        start, end = month_week_bounds(week)
        due_before = end - timedelta(microseconds=1)
        tasks, _ = self._fetch(
            {
                "assignee_id": assignee_id,
                "due_after": start.isoformat(),
                "due_before": due_before.isoformat(),
            }
        )
        tasks = [t for t in tasks if t.status not in ("completed", "cancelled")]
        return tasks, len(tasks)

    def team_today_snapshot(self) -> list[dict]:
        users = (
            self.db.query(User)
            .filter(User.status == "active")
            .order_by(User.first_name, User.last_name)
            .all()
        )
        rows = []
        for u in users:
            today, today_n = self.tasks_today(u.id)
            _, wip_n = self.tasks_by_status(u.id, "in_progress")
            _, overdue_n = self.tasks_backlog(u.id)
            if not today and wip_n == 0 and overdue_n == 0:
                continue
            rows.append(
                {
                    "user": u,
                    "today_count": today_n,
                    "wip_count": wip_n,
                    "overdue_count": overdue_n,
                }
            )
        return rows

    @staticmethod
    def task_line(task: Task) -> str:
        status = STATUS_LABELS.get(task.status, task.status)
        parts = [task.title.strip() or f"Task #{task.id}", status]
        if task.due_date:
            due = task.due_date.astimezone(get_app_timezone()).strftime("%d-%m-%y")
            parts.append(f"due {due}")
        if task.estimated_hours is not None:
            hours = task.estimated_hours
            # Prefer clean ints when whole hours (e.g. 2 not 2.0)
            hours_label = str(int(hours)) if float(hours).is_integer() else str(hours)
            parts.append(f"{hours_label}h")
        else:
            parts.append("time n/a")
        return " | ".join(parts)

    @staticmethod
    def tasks_to_summary_payload(tasks: list[Task], *, assignee_name: str | None = None) -> list[dict]:
        rows = []
        for t in tasks[:30]:
            rows.append(
                {
                    "title": t.title,
                    "status": t.status,
                    "estimated_hours": t.estimated_hours,
                    "due_date": t.due_date.isoformat() if t.due_date else None,
                    "assignee": assignee_name,
                }
            )
        return rows
