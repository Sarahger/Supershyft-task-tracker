from __future__ import annotations

from datetime import date, datetime, timezone

from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.core.company_holidays import is_listed_company_holiday, is_weekend_off, is_working_day
from app.core.constants import (
    ActivityType,
    AttendanceStatus,
    TaskStatus,
    UserStatus,
    WeeklyCommitmentType,
    WeeklyCompletionSource,
    WeeklyReportStatus,
)
from app.models import (
    Attendance,
    DailyUpdate,
    Task,
    TaskAssignee,
    TaskDeadlineRevision,
    User,
    WeeklyReport,
    WeeklyReportCommitment,
    WeeklyReportCompletion,
    user_departments,
)
from app.repositories.base import ActivityRepository, user_to_brief_dict
from app.services.task_service import TaskService
from app.utils.week_periods import (
    RESOLVED_STATUSES,
    as_local_date,
    current_week_start,
    due_at_noon,
    editable_until_for,
    is_report_editable,
    monday_of,
    now_local,
    period_datetime_bounds,
    period_end_for_submit,
    planning_window,
    resolve_period,
    today_local,
)


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _is_overdue(task: Task, now: datetime | None = None) -> bool:
    if not task.due_date or task.status in RESOLVED_STATUSES:
        return False
    due = task.due_date
    if due.tzinfo is None:
        due = due.replace(tzinfo=timezone.utc)
    current = now or _utc_now()
    if current.tzinfo is None:
        current = current.replace(tzinfo=timezone.utc)
    return due < current


def _author(user: User | None) -> dict | None:
    if not user:
        return None
    brief = user_to_brief_dict(user) or {}
    brief["job_title"] = user.job_title
    return brief


def _coerce_due(value: datetime | date) -> datetime:
    if isinstance(value, datetime):
        if value.tzinfo is None:
            return due_at_noon(value.date())
        return value
    return due_at_noon(value)


class WeeklyUpdateService:
    def __init__(self, db: Session):
        self.db = db
        self.tasks = TaskService(db)
        self.activity = ActivityRepository(db)

    def _period(self, period_start: date | None = None):
        try:
            return resolve_period(period_start)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    def _active_users(self, department_id: int | None = None) -> list[User]:
        query = (
            self.db.query(User)
            .options(joinedload(User.departments))
            .filter(User.status != UserStatus.INACTIVE.value)
            .order_by(User.first_name, User.last_name)
        )
        if department_id:
            query = query.join(user_departments, user_departments.c.user_id == User.id).filter(
                user_departments.c.department_id == department_id
            )
        return query.all()

    def _report_for(self, user_id: int, period_start: date) -> WeeklyReport | None:
        return (
            self.db.query(WeeklyReport)
            .options(
                joinedload(WeeklyReport.completions).joinedload(WeeklyReportCompletion.task),
                joinedload(WeeklyReport.commitments).joinedload(WeeklyReportCommitment.task),
                joinedload(WeeklyReport.user),
            )
            .filter(WeeklyReport.user_id == user_id, WeeklyReport.period_start == period_start)
            .first()
        )

    def leave_context(self, user_id: int, start: date, end: date) -> dict:
        if end < start:
            start, end = end, start
        rows = (
            self.db.query(Attendance)
            .filter(
                Attendance.user_id == user_id,
                Attendance.attendance_date >= start,
                Attendance.attendance_date <= end,
            )
            .all()
        )
        by_day = {r.attendance_date: r.status for r in rows}
        holidays: list[dict] = []
        leave_days: list[dict] = []
        working_days = 0.0
        cursor = start
        while cursor <= end:
            if is_listed_company_holiday(cursor):
                holidays.append({"date": cursor.isoformat(), "kind": "holiday", "label": "Public holiday"})
            elif is_weekend_off(cursor):
                holidays.append({"date": cursor.isoformat(), "kind": "weekend", "label": "Weekend off"})
            status = by_day.get(cursor)
            if status in (AttendanceStatus.LEAVE.value, AttendanceStatus.HALF_DAY.value):
                leave_days.append(
                    {
                        "date": cursor.isoformat(),
                        "status": status,
                        "label": "Half day" if status == AttendanceStatus.HALF_DAY.value else "Leave",
                    }
                )
            if is_working_day(cursor):
                if status == AttendanceStatus.LEAVE.value:
                    pass
                elif status == AttendanceStatus.HALF_DAY.value:
                    working_days += 0.5
                else:
                    working_days += 1
            cursor = cursor.fromordinal(cursor.toordinal() + 1)
        return {
            "start": start.isoformat(),
            "end": end.isoformat(),
            "working_days": working_days,
            "holidays": holidays,
            "leave_days": leave_days,
        }

    def get_leave_context(self, user: User, period_start: date | None = None) -> dict:
        period = self._period(period_start)
        return {
            "period_start": period.period_start.isoformat(),
            "reporting": self.leave_context(user.id, period.period_start, period.period_end),
            "planning": self.leave_context(user.id, period.planning_start, period.planning_end),
        }

    def suggestions(self, user: User, period_start: date | None = None) -> dict:
        period = self._period(period_start)
        adopted_at = user.weekly_updates_adopted_at
        if not adopted_at:
            return {
                "period_start": period.period_start.isoformat(),
                "period_end": period.period_end.isoformat(),
                "adopted_at": None,
                "items": [],
            }
        start_dt, end_dt = period_datetime_bounds(period.period_start, period.period_end)
        if adopted_at.tzinfo is None:
            adopted_at = adopted_at.replace(tzinfo=timezone.utc)
        already = set()
        existing = self._report_for(user.id, period.period_start)
        if existing:
            already = {c.task_id for c in existing.completions if c.task_id and c.included}

        rows = (
            self.db.query(Task)
            .join(TaskAssignee, TaskAssignee.task_id == Task.id)
            .filter(
                TaskAssignee.user_id == user.id,
                Task.status == TaskStatus.COMPLETED.value,
                Task.is_archived.is_(False),
                Task.completed_at.isnot(None),
                Task.completed_at >= start_dt,
                Task.completed_at < end_dt,
                Task.completed_at >= adopted_at,
            )
            .order_by(Task.completed_at.desc())
            .all()
        )
        items = []
        seen: set[int] = set()
        for task in rows:
            if task.id in already or task.id in seen:
                continue
            seen.add(task.id)
            items.append(
                {
                    "task_id": task.id,
                    "title": task.title,
                    "completion_date": as_local_date(task.completed_at),
                    "completed_at": task.completed_at,
                    "source": WeeklyCompletionSource.SUGGESTED.value,
                    "included": True,
                }
            )
        return {
            "period_start": period.period_start.isoformat(),
            "period_end": period.period_end.isoformat(),
            "adopted_at": adopted_at,
            "items": items,
        }

    def carry_forward(self, user: User, period_start: date | None = None) -> dict:
        period = self._period(period_start)
        rows = (
            self.db.query(WeeklyReportCommitment)
            .join(WeeklyReport, WeeklyReportCommitment.weekly_report_id == WeeklyReport.id)
            .options(
                joinedload(WeeklyReportCommitment.task).joinedload(Task.deadline_revisions),
                joinedload(WeeklyReportCommitment.report),
            )
            .filter(
                WeeklyReport.user_id == user.id,
                WeeklyReport.period_start < period.period_start,
                WeeklyReportCommitment.task_id.isnot(None),
            )
            .order_by(WeeklyReport.period_start.asc())
            .all()
        )
        items: list[dict] = []
        seen: set[int] = set()
        for row in rows:
            task = row.task
            if not task or task.id in seen or task.is_archived or task.status in RESOLVED_STATUSES:
                continue
            seen.add(task.id)
            items.append(self._commitment_view(row, carried=True))
        return {
            "period_start": period.period_start.isoformat(),
            "items": items,
        }

    def overview(self, department_id: int | None = None, period_start: date | None = None) -> dict:
        period = self._period(period_start)
        users = self._active_users(department_id)
        user_ids = [u.id for u in users]
        reports = (
            self.db.query(WeeklyReport)
            .filter(WeeklyReport.period_start == period.period_start, WeeklyReport.user_id.in_(user_ids or [0]))
            .all()
            if user_ids
            else []
        )
        submitted_ids = {r.user_id for r in reports if r.status == WeeklyReportStatus.SUBMITTED.value}
        start_dt, end_dt = period_datetime_bounds(period.period_start, period.period_end)
        completed = 0
        if user_ids:
            completed = (
                self.db.query(Task.id)
                .join(TaskAssignee, TaskAssignee.task_id == Task.id)
                .filter(
                    TaskAssignee.user_id.in_(user_ids),
                    Task.status == TaskStatus.COMPLETED.value,
                    Task.is_archived.is_(False),
                    Task.completed_at.isnot(None),
                    Task.completed_at >= start_dt,
                    Task.completed_at < end_dt,
                )
                .distinct()
                .count()
            )

        upcoming = 0
        overdue = 0
        carried = 0
        if user_ids:
            commitments = (
                self.db.query(WeeklyReportCommitment)
                .join(WeeklyReport, WeeklyReportCommitment.weekly_report_id == WeeklyReport.id)
                .options(joinedload(WeeklyReportCommitment.task))
                .filter(WeeklyReport.user_id.in_(user_ids), WeeklyReportCommitment.task_id.isnot(None))
                .all()
            )
            upcoming_seen: set[int] = set()
            overdue_seen: set[int] = set()
            carried_seen: set[int] = set()
            for row in commitments:
                task = row.task
                if not task or task.is_archived:
                    continue
                if (
                    row.report.period_start == period.period_start
                    and task.status not in RESOLVED_STATUSES
                    and task.id not in upcoming_seen
                ):
                    upcoming_seen.add(task.id)
                    upcoming += 1
                if _is_overdue(task) and task.id not in overdue_seen:
                    overdue_seen.add(task.id)
                    overdue += 1
                if (
                    row.report.period_start < period.period_start
                    and task.status not in RESOLVED_STATUSES
                    and task.id not in carried_seen
                ):
                    carried_seen.add(task.id)
                    carried += 1

        return {
            "period_start": period.period_start.isoformat(),
            "period_end": period.period_end.isoformat(),
            "planning_start": period.planning_start.isoformat(),
            "planning_end": period.planning_end.isoformat(),
            "department_id": department_id,
            "submitted": len(submitted_ids),
            "pending": max(0, len(users) - len(submitted_ids)),
            "completed": completed,
            "upcoming": upcoming,
            "overdue": overdue,
            "carried_forward": carried,
            "employee_count": len(users),
        }

    def employees(self, department_id: int | None = None, period_start: date | None = None) -> dict:
        period = self._period(period_start)
        users = self._active_users(department_id)
        user_ids = [u.id for u in users]
        submitted_ids: set[int] = set()
        overdue_ids: set[int] = set()
        if user_ids:
            reports = (
                self.db.query(WeeklyReport)
                .filter(
                    WeeklyReport.period_start == period.period_start,
                    WeeklyReport.user_id.in_(user_ids),
                    WeeklyReport.status == WeeklyReportStatus.SUBMITTED.value,
                )
                .all()
            )
            submitted_ids = {r.user_id for r in reports}
            commitments = (
                self.db.query(WeeklyReportCommitment)
                .join(WeeklyReport, WeeklyReportCommitment.weekly_report_id == WeeklyReport.id)
                .options(joinedload(WeeklyReportCommitment.task))
                .filter(WeeklyReport.user_id.in_(user_ids), WeeklyReportCommitment.task_id.isnot(None))
                .all()
            )
            for row in commitments:
                if row.task and _is_overdue(row.task):
                    overdue_ids.add(row.report.user_id)

        items = []
        for user in users:
            items.append(
                {
                    "id": user.id,
                    "first_name": user.first_name,
                    "last_name": user.last_name,
                    "profile_picture": user.profile_picture,
                    "job_title": user.job_title,
                    "departments": [{"id": d.id, "name": d.name} for d in (user.departments or [])],
                    "has_submitted": user.id in submitted_ids,
                    "has_overdue": user.id in overdue_ids,
                }
            )
        return {
            "period_start": period.period_start.isoformat(),
            "items": items,
        }

    def user_history(self, user_id: int, week_start: date | None = None) -> dict:
        user = self.db.query(User).options(joinedload(User.departments)).filter(User.id == user_id).first()
        if not user or user.status == UserStatus.INACTIVE.value:
            raise HTTPException(status_code=404, detail="User not found")
        period = self._period(week_start)
        reports = (
            self.db.query(WeeklyReport)
            .options(
                joinedload(WeeklyReport.completions).joinedload(WeeklyReportCompletion.task),
                joinedload(WeeklyReport.commitments).joinedload(WeeklyReportCommitment.task).joinedload(
                    Task.deadline_revisions
                ),
                joinedload(WeeklyReport.user),
            )
            .filter(WeeklyReport.user_id == user_id)
            .order_by(WeeklyReport.period_start.desc())
            .all()
        )
        outstanding = self.carry_forward(user, period.period_start)["items"]
        daily_notes = (
            self.db.query(DailyUpdate)
            .options(joinedload(DailyUpdate.user), joinedload(DailyUpdate.tasks))
            .filter(DailyUpdate.user_id == user_id)
            .order_by(DailyUpdate.update_date.desc())
            .limit(40)
            .all()
        )
        return {
            "user": {
                **(_author(user) or {}),
                "departments": [{"id": d.id, "name": d.name} for d in (user.departments or [])],
                "weekly_updates_adopted_at": user.weekly_updates_adopted_at,
            },
            "current_period_start": period.period_start.isoformat(),
            "focus_week": period.period_start.isoformat() if week_start else None,
            "reports": [self._report_view(r) for r in reports],
            "outstanding": outstanding,
            "legacy_daily_notes": [
                {
                    "id": note.id,
                    "update_date": note.update_date.isoformat(),
                    "content": note.content or "",
                    "tasks": [{"id": t.id, "title": t.title} for t in (note.tasks or [])],
                }
                for note in daily_notes
            ],
        }

    def upsert(self, user: User, payload: dict) -> dict:
        raw_start = payload.get("period_start")
        if raw_start is None:
            raise HTTPException(status_code=400, detail="period_start is required")
        start = raw_start if isinstance(raw_start, date) else date.fromisoformat(str(raw_start))
        if start != monday_of(start):
            raise HTTPException(status_code=400, detail="period_start must be a Monday")
        today = today_local()
        if start > today:
            raise HTTPException(status_code=400, detail="Cannot submit a weekly update for a week that has not started")

        period_end = period_end_for_submit(start, today)
        plan_start, plan_end = planning_window(start)

        report = self._report_for(user.id, start)
        if report and not is_report_editable(report.period_start, report.status):
            raise HTTPException(
                status_code=403,
                detail="This weekly update can only be edited until 10:30 AM on the following Monday",
            )

        completions_in: list[dict] = payload.get("completions") or []
        commitments_in: list[dict] = payload.get("commitments") or []
        self._validate_payload(user, completions_in, commitments_in)

        if report is None:
            report = WeeklyReport(
                user_id=user.id,
                period_start=start,
                period_end=period_end,
                planning_start=plan_start,
                planning_end=plan_end,
                status=WeeklyReportStatus.DRAFT.value,
            )
            self.db.add(report)
            try:
                self.db.flush()
            except IntegrityError:
                self.db.rollback()
                report = self._report_for(user.id, start)
                if report is None:
                    raise
                if not is_report_editable(report.period_start, report.status):
                    raise HTTPException(
                        status_code=403,
                        detail="This weekly update can only be edited until 10:30 AM on the following Monday",
                    )

        report.period_end = period_end
        report.planning_start = plan_start
        report.planning_end = plan_end
        report.leave_notes = payload.get("leave_notes") or None
        self.db.flush()

        if user.weekly_updates_adopted_at is None:
            user.weekly_updates_adopted_at = _utc_now()

        self._replace_completions(report, completions_in)
        create_errors = self._upsert_commitments(user, report, commitments_in)

        report.status = WeeklyReportStatus.SUBMITTED.value
        if report.submitted_at is None:
            report.submitted_at = _utc_now()
        self.db.commit()
        self.db.refresh(report)
        view = self._report_view(self._report_for(user.id, start) or report)
        view["create_errors"] = create_errors
        return view

    def revise_deadline(
        self,
        task: Task,
        user: User,
        reason: str,
        new_due_date: datetime,
        weekly_report_id: int | None = None,
    ) -> dict:
        if user.id not in {a.user_id for a in (task.assignees or [])}:
            raise HTTPException(status_code=403, detail="Only the assignee can revise this deadline")
        if task.status in RESOLVED_STATUSES:
            raise HTTPException(status_code=400, detail="Resolved tasks cannot have their deadline revised")
        if not _is_overdue(task):
            raise HTTPException(status_code=400, detail="Only overdue tasks require a deadline revision")
        cleaned = (reason or "").strip()
        if not cleaned:
            raise HTTPException(status_code=400, detail="A reason for the delay is required")
        new_due = _coerce_due(new_due_date)
        if as_local_date(new_due) is None:
            raise HTTPException(status_code=400, detail="A revised deadline is required")
        previous = task.due_date
        if task.original_due_date is None and previous is not None:
            task.original_due_date = previous
        revision = TaskDeadlineRevision(
            task_id=task.id,
            previous_due_date=previous,
            new_due_date=new_due,
            reason=cleaned,
            changed_by_id=user.id,
            weekly_report_id=weekly_report_id,
        )
        self.db.add(revision)
        task.due_date = new_due
        self.db.commit()
        self.db.refresh(task)
        self.activity.log(
            user.id,
            ActivityType.DUE_DATE_CHANGED.value,
            f"Revised deadline for {task.title}",
            task.id,
            metadata={
                "previous_due_date": previous.isoformat() if previous else None,
                "new_due_date": new_due.isoformat(),
                "reason": cleaned,
            },
        )
        return self._revision_view(revision, task)

    def list_revisions(self, task: Task) -> list[dict]:
        rows = (
            self.db.query(TaskDeadlineRevision)
            .options(joinedload(TaskDeadlineRevision.changed_by))
            .filter(TaskDeadlineRevision.task_id == task.id)
            .order_by(TaskDeadlineRevision.created_at.asc())
            .all()
        )
        return [self._revision_view(row, task) for row in rows]

    def format_weekly_for_telegram(self, user: User, target: User | None = None) -> dict:
        subject = target or user
        history = self.user_history(subject.id)
        latest = history["reports"][0] if history["reports"] else None
        return {"user": history["user"], "report": latest, "outstanding": history["outstanding"]}

    def _validate_payload(self, user: User, completions: list[dict], commitments: list[dict]) -> None:
        seen_completion_tasks: set[int] = set()
        for item in completions:
            if not item.get("included", True):
                continue
            title = (item.get("title") or "").strip()
            if not title:
                raise HTTPException(status_code=400, detail="Each completed item needs a title")
            task_id = item.get("task_id")
            if task_id:
                if task_id in seen_completion_tasks:
                    raise HTTPException(status_code=400, detail="The same task cannot appear twice in completed work")
                seen_completion_tasks.add(task_id)

        seen_commitment_tasks: set[int] = set()
        for item in commitments:
            title = (item.get("title") or "").strip()
            if not title:
                raise HTTPException(status_code=400, detail="Each planned task needs a title")
            hours = item.get("estimated_hours")
            if hours is None or float(hours) <= 0:
                raise HTTPException(status_code=400, detail="Each planned task needs an estimated effort greater than zero")
            if not item.get("due_date"):
                raise HTTPException(status_code=400, detail="Each planned task needs an exact due date")
            ctype = item.get("commitment_type") or WeeklyCommitmentType.NEW.value
            if ctype not in {t.value for t in WeeklyCommitmentType}:
                raise HTTPException(status_code=400, detail="Invalid commitment type")
            task_id = item.get("task_id")
            if ctype in (WeeklyCommitmentType.EXISTING.value, WeeklyCommitmentType.CARRIED_FORWARD.value) and not task_id:
                raise HTTPException(status_code=400, detail="Existing and carried-forward tasks must reference a tracker task")
            if task_id:
                if task_id in seen_commitment_tasks:
                    raise HTTPException(status_code=400, detail="The same task cannot appear twice in next week's plan")
                seen_commitment_tasks.add(task_id)

    def _replace_completions(self, report: WeeklyReport, items: list[dict]) -> None:
        report.completions.clear()
        self.db.flush()
        seen: set[int] = set()
        for item in items:
            if not item.get("included", True):
                continue
            task_id = item.get("task_id")
            if task_id:
                if task_id in seen:
                    continue
                seen.add(task_id)
            source = item.get("source") or WeeklyCompletionSource.MANUAL.value
            if source not in {s.value for s in WeeklyCompletionSource}:
                source = WeeklyCompletionSource.MANUAL.value
            report.completions.append(
                WeeklyReportCompletion(
                    task_id=task_id,
                    title=(item.get("title") or "").strip(),
                    completion_date=item.get("completion_date") or today_local(),
                    source=source,
                    included=True,
                )
            )
        self.db.flush()

    def _upsert_commitments(self, user: User, report: WeeklyReport, items: list[dict]) -> list[dict]:
        existing = list(report.commitments)
        by_task = {c.task_id: c for c in existing if c.task_id}
        by_title = {(c.commitment_type, c.title.strip().lower()): c for c in existing}
        by_title_any = {c.title.strip().lower(): c for c in existing}
        kept: set[int] = set()
        errors: list[dict] = []

        for item in items:
            ctype = item.get("commitment_type") or WeeklyCommitmentType.NEW.value
            title = (item.get("title") or "").strip()
            due = _coerce_due(item["due_date"])
            task_id = item.get("task_id")
            row = None
            if task_id and task_id in by_task:
                row = by_task[task_id]
            elif (ctype, title.lower()) in by_title:
                row = by_title[(ctype, title.lower())]
            elif title.lower() in by_title_any:
                row = by_title_any[title.lower()]
            if row is None:
                row = WeeklyReportCommitment(
                    weekly_report_id=report.id,
                    title=title,
                    due_date=due,
                    commitment_type=ctype,
                )
                self.db.add(row)
                report.commitments.append(row)
                self.db.flush()

            row.title = title
            row.description = item.get("description") or None
            row.estimated_hours = float(item["estimated_hours"])
            row.due_date = due
            row.commitment_type = ctype
            if task_id:
                row.task_id = task_id
            kept.add(row.id)

            try:
                self._apply_commitment_task(user, report, row, item, due)
                row.create_error = None
            except HTTPException as exc:
                row.create_error = str(exc.detail)
                errors.append({"title": title, "task_id": row.task_id, "error": str(exc.detail)})
            except Exception as exc:  # noqa: BLE001 — surface create failures without aborting the report
                row.create_error = str(exc)
                errors.append({"title": title, "task_id": row.task_id, "error": str(exc)})
            self.db.flush()

        for row in list(report.commitments):
            if row.id not in kept:
                self.db.delete(row)
        self.db.flush()
        return errors

    def _apply_commitment_task(
        self,
        user: User,
        report: WeeklyReport,
        row: WeeklyReportCommitment,
        item: dict,
        due: datetime,
    ) -> None:
        ctype = row.commitment_type
        if ctype in (WeeklyCommitmentType.EXISTING.value, WeeklyCommitmentType.CARRIED_FORWARD.value):
            task = self.db.query(Task).options(joinedload(Task.assignees)).filter(Task.id == row.task_id).first()
            if not task or task.is_archived:
                raise HTTPException(status_code=400, detail=f"Task not found for '{row.title}'")
            if user.id not in {a.user_id for a in task.assignees}:
                raise HTTPException(status_code=400, detail=f"You are not assigned to '{task.title}'")
            if row.original_due_date is None:
                row.original_due_date = task.original_due_date or task.due_date or due
            if task.original_due_date is None:
                task.original_due_date = row.original_due_date
            if item.get("estimated_hours"):
                task.estimated_hours = float(item["estimated_hours"])
            if _is_overdue(task):
                reason = (item.get("revision_reason") or "").strip()
                new_due = due
                if as_local_date(task.due_date) != as_local_date(new_due):
                    if not reason:
                        raise HTTPException(
                            status_code=400,
                            detail=f"'{task.title}' is overdue and needs a reason plus a revised deadline",
                        )
                    self._record_revision(task, user, reason, new_due, report.id)
                elif not reason and as_local_date(task.due_date) <= today_local():
                    raise HTTPException(
                        status_code=400,
                        detail=f"'{task.title}' is overdue and needs a reason plus a revised deadline",
                    )
            else:
                task.due_date = due
            return

        if row.task_id:
            task = self.db.query(Task).filter(Task.id == row.task_id).first()
            if task:
                if task.original_due_date is None:
                    task.original_due_date = row.original_due_date or due
                if row.original_due_date is None:
                    row.original_due_date = task.original_due_date or due
                task.due_date = due
                if item.get("estimated_hours"):
                    task.estimated_hours = float(item["estimated_hours"])
                return

        created = self.tasks.create_task(
            {
                "title": row.title,
                "description": row.description,
                "priority": "medium",
                "status": TaskStatus.TODO.value,
                "estimated_hours": float(item["estimated_hours"]),
                "due_date": due,
                "assignee_ids": [user.id],
            },
            user,
        )
        row.task_id = created.id
        row.original_due_date = due
        created.original_due_date = created.original_due_date or due
        created.due_date = due
        self.db.flush()

    def _record_revision(
        self,
        task: Task,
        user: User,
        reason: str,
        new_due: datetime,
        weekly_report_id: int | None,
    ) -> None:
        previous = task.due_date
        if task.original_due_date is None and previous is not None:
            task.original_due_date = previous
        self.db.add(
            TaskDeadlineRevision(
                task_id=task.id,
                previous_due_date=previous,
                new_due_date=new_due,
                reason=reason,
                changed_by_id=user.id,
                weekly_report_id=weekly_report_id,
            )
        )
        task.due_date = new_due
        self.activity.log(
            user.id,
            ActivityType.DUE_DATE_CHANGED.value,
            f"Revised deadline for {task.title}",
            task.id,
            metadata={
                "previous_due_date": previous.isoformat() if previous else None,
                "new_due_date": new_due.isoformat(),
                "reason": reason,
            },
        )

    def _report_view(self, report: WeeklyReport) -> dict:
        current = current_week_start()
        return {
            "id": report.id,
            "user_id": report.user_id,
            "period_start": report.period_start.isoformat(),
            "period_end": report.period_end.isoformat(),
            "planning_start": report.planning_start.isoformat(),
            "planning_end": report.planning_end.isoformat(),
            "status": report.status,
            "submitted_at": report.submitted_at,
            "leave_notes": report.leave_notes,
            "editable": is_report_editable(report.period_start, report.status),
            "editable_until": editable_until_for(report.period_start),
            "is_current": report.period_start == current,
            "author": _author(report.user),
            "completions": [self._completion_view(c) for c in report.completions if c.included],
            "commitments": [self._commitment_view(c) for c in report.commitments],
            "leave": self.leave_context(report.user_id, report.period_start, report.period_end),
            "planning_leave": self.leave_context(report.user_id, report.planning_start, report.planning_end),
            "created_at": report.created_at,
            "updated_at": report.updated_at,
        }

    def _completion_view(self, row: WeeklyReportCompletion) -> dict:
        task = row.task
        return {
            "id": row.id,
            "task_id": row.task_id,
            "title": row.title,
            "completion_date": row.completion_date.isoformat() if row.completion_date else None,
            "source": row.source,
            "included": row.included,
            "task_status": task.status if task else None,
            "completed_at": task.completed_at if task else None,
        }

    def _commitment_view(self, row: WeeklyReportCommitment, carried: bool = False) -> dict:
        task = row.task
        revisions = []
        if task is not None:
            revisions = [
                {
                    "id": rev.id,
                    "previous_due_date": rev.previous_due_date,
                    "new_due_date": rev.new_due_date,
                    "reason": rev.reason,
                    "changed_by": _author(rev.changed_by) if getattr(rev, "changed_by", None) else None,
                    "created_at": rev.created_at,
                }
                for rev in (task.deadline_revisions or [])
            ]
        overdue = bool(task and _is_overdue(task))
        return {
            "id": row.id,
            "task_id": row.task_id,
            "title": task.title if task else row.title,
            "description": row.description,
            "estimated_hours": row.estimated_hours if row.estimated_hours is not None else (task.estimated_hours if task else None),
            "due_date": task.due_date if task and task.due_date else row.due_date,
            "original_due_date": (task.original_due_date if task and task.original_due_date else row.original_due_date)
            or row.due_date,
            "commitment_type": WeeklyCommitmentType.CARRIED_FORWARD.value
            if carried
            else row.commitment_type,
            "create_error": row.create_error,
            "task_status": task.status if task else None,
            "is_overdue": overdue,
            "is_carried_forward": carried or row.commitment_type == WeeklyCommitmentType.CARRIED_FORWARD.value,
            "is_resolved": bool(task and task.status in RESOLVED_STATUSES),
            "period_start": row.report.period_start.isoformat() if row.report else None,
            "deadline_revisions": revisions,
        }

    def _revision_view(self, row: TaskDeadlineRevision, task: Task) -> dict:
        return {
            "id": row.id,
            "task_id": row.task_id,
            "previous_due_date": row.previous_due_date,
            "new_due_date": row.new_due_date,
            "reason": row.reason,
            "changed_by": _author(row.changed_by) if row.changed_by else None,
            "weekly_report_id": row.weekly_report_id,
            "created_at": row.created_at,
            "original_due_date": task.original_due_date,
            "current_due_date": task.due_date,
        }
