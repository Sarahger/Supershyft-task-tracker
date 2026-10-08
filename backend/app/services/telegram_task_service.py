"""Deterministic task queries for Telegram commands (no AI)."""

from __future__ import annotations

from datetime import timedelta

from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.core.constants import UserRole
from app.models import Department, Task, User
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

# Common short names → department name fragments for matching
DEPARTMENT_ALIASES = {
    "tech": "technology",
    "technology": "technology",
    "design": "design",
    "sales": "sales",
    "product": "product",
    "marketing": "marketing",
    "ops": "operations",
    "operations": "operations",
    "finance": "finance",
    "hr": "hr",
    "human resources": "hr",
}


def format_estimated_duration(hours: float | int | None) -> str:
    """
    Format estimated hours for Telegram:
    - < 1h → minutes only (e.g. 30m, 45m)
    - whole hours → 2h
    - mixed → 2h30m
    """
    if hours is None:
        return "time n/a"
    try:
        total_minutes = int(round(float(hours) * 60))
    except (TypeError, ValueError):
        return "time n/a"
    if total_minutes <= 0:
        return "0m"
    h, m = divmod(total_minutes, 60)
    if h == 0:
        return f"{m}m"
    if m == 0:
        return f"{h}h"
    return f"{h}h{m}m"


class TelegramTaskService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = TaskRepository(db)

    def is_manager(self, user: User) -> bool:
        return user.role in (UserRole.ADMIN.value, UserRole.MANAGER.value)

    def resolve_users_by_name(self, name: str) -> list[User]:
        """
        Resolve people by name with exact-first-name rules:
        - One word  → exact first name only (case-insensitive).
          "harsh" matches Harsh, not Harshili.
        - Two+ words → exact first name + exact last name (then last-name prefix).
          Use surname when multiple people share the same first name.
        """
        term = (name or "").strip()
        if not term:
            return []
        parts = term.split()
        active = self.db.query(User).filter(User.status != "inactive")

        if len(parts) == 1:
            token = parts[0].lower()
            return (
                active.filter(func.lower(User.first_name) == token)
                .order_by(User.first_name, User.last_name)
                .limit(20)
                .all()
            )

        first = parts[0].lower()
        last = " ".join(parts[1:]).lower()
        exact = (
            active.filter(
                func.lower(User.first_name) == first,
                func.lower(User.last_name) == last,
            )
            .order_by(User.first_name, User.last_name)
            .limit(10)
            .all()
        )
        if exact:
            return exact
        # Allow short surname typing: "Harsh Ku" → Harsh Kumar
        return (
            active.filter(
                func.lower(User.first_name) == first,
                User.last_name.ilike(f"{last}%"),
            )
            .order_by(User.first_name, User.last_name)
            .limit(10)
            .all()
        )

    def resolve_department_by_name(self, name: str) -> tuple[Department | None, list[Department]]:
        """
        Resolve a department by name / alias.
        Returns (exact_or_single_match, all_partial_matches).
        """
        term = (name or "").strip()
        if not term:
            return None, []
        alias = DEPARTMENT_ALIASES.get(term.lower(), term.lower())
        depts = self.db.query(Department).order_by(Department.name.asc()).all()
        exact = [d for d in depts if d.name.lower() == alias or d.name.lower() == term.lower()]
        if len(exact) == 1:
            return exact[0], exact
        if exact:
            return None, exact
        partial = [d for d in depts if alias in d.name.lower() or term.lower() in d.name.lower()]
        if len(partial) == 1:
            return partial[0], partial
        return None, partial

    def list_department_names(self) -> list[str]:
        return [d.name for d in self.db.query(Department).order_by(Department.name.asc()).all()]

    def tasks_for_department(
        self,
        department_id: int,
        *,
        kind: str | None = None,
        limit: int = 40,
    ) -> tuple[list[Task], int]:
        """Open tasks assigned to anyone in the department (optionally filtered)."""
        filters: dict = {"department_id": department_id}
        if kind == "today":
            start, end = today_bounds()
            filters["due_after"] = start.isoformat()
            filters["due_before"] = (end - timedelta(microseconds=1)).isoformat()
            tasks, _ = self._fetch(filters, limit=limit)
            # Keep completed due today; only drop cancelled
            tasks = [t for t in tasks if t.status != "cancelled"]
            # Also include overdue WIP for the dept (same spirit as personal /today)
            overdue, _ = self._fetch(
                {"department_id": department_id, "overdue": True, "status": "in_progress"},
                limit=limit,
            )
            seen = {t.id for t in tasks}
            for t in overdue:
                if t.id not in seen:
                    tasks.append(t)
                    seen.add(t.id)
            return tasks, len(tasks)
        if kind == "wip":
            filters["status"] = "in_progress"
        elif kind == "todos":
            filters["status"] = "to_do"
        elif kind == "backlog":
            filters["overdue"] = True
        else:
            # Default: open work only
            filters["status"] = ["to_do", "in_progress", "blocked", "in_review", "approved", "testing", "bugs_found"]

        tasks, total = self._fetch(filters, limit=limit)
        if kind not in ("wip", "todos", "backlog") and "status" in filters:
            tasks = [t for t in tasks if t.status not in ("completed", "cancelled")]
            total = len(tasks)
        return tasks, total

    @staticmethod
    def assignee_names(task: Task) -> str:
        names: list[str] = []
        for link in task.assignees or []:
            user = getattr(link, "user", None)
            if user:
                names.append(user.full_name)
        return ", ".join(names) if names else "Unassigned"

    def _fetch(self, filters: dict, *, limit: int = 25) -> tuple[list[Task], int]:
        return self.repo.get_filtered(skip=0, limit=limit, filters=filters)

    def tasks_today_all(self, *, limit: int = 50) -> tuple[list[Task], int]:
        """Everyone's tasks due today (+ overdue WIP), company-wide."""
        start, end = today_bounds()
        due_before = end - timedelta(microseconds=1)
        due_today, _ = self._fetch(
            {
                "due_after": start.isoformat(),
                "due_before": due_before.isoformat(),
            },
            limit=limit,
        )
        due_today = [t for t in due_today if t.status != "cancelled"]
        overdue, _ = self._fetch({"overdue": True, "status": "in_progress"}, limit=limit)
        seen = {t.id for t in due_today}
        combined = list(due_today)
        for t in overdue:
            if t.id not in seen:
                combined.append(t)
                seen.add(t.id)
        return combined, len(combined)

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
        # Include completed tasks due today; only exclude cancelled
        due_today = [t for t in due_today if t.status != "cancelled"]

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
            parts.append(format_estimated_duration(task.estimated_hours))
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
