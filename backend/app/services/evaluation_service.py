"""KRA/KPI evaluations for flexible periods (1 week–1 month). Monthly score = average of submitted periods."""

from __future__ import annotations

import json
from calendar import monthrange
from datetime import date, datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.core.company_holidays import is_working_day
from app.core.constants import AttendanceStatus
from app.core.kra_scorecard import (
    KRA_PARAMETERS,
    PARAMETER_BY_KEY,
    RATING_SCALE,
    overall_score,
    weighted_score,
)
from app.models import (
    Attendance,
    EmployeeEvaluation,
    EmployeeEvaluationRevision,
    EmployeeEvaluationScore,
    User,
)

MIN_PERIOD_DAYS = 7
LEAVE_STATUSES = {AttendanceStatus.LEAVE.value, AttendanceStatus.HALF_DAY.value}


def calendar_month_start(value: date) -> date:
    return value.replace(day=1)


def calendar_month_end(value: date) -> date:
    return date(value.year, value.month, monthrange(value.year, value.month)[1])


def month_start(value: date) -> date:
    """Normalize a browse/filter month. Accepts any day in the month."""
    return calendar_month_start(value)


def _author(user: User | None) -> dict | None:
    if user is None:
        return None
    return {
        "id": user.id,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "name": user.full_name,
    }


def _department_names(user: User | None) -> list[str]:
    if user is None:
        return []
    return [d.name for d in (user.departments or [])]


def _effective_end(row: EmployeeEvaluation) -> date:
    return row.period_end or calendar_month_end(row.period_start)


def _ranges_overlap(start_a: date, end_a: date, start_b: date, end_b: date) -> bool:
    return start_a <= end_b and start_b <= end_a


def _iter_days(start: date, end: date):
    cursor = start
    while cursor <= end:
        yield cursor
        cursor += timedelta(days=1)


def _working_days(start: date, end: date) -> list[date]:
    return [day for day in _iter_days(start, end) if is_working_day(day)]


def _leave_day_payload(day: date, status: str) -> dict:
    return {
        "date": day.isoformat(),
        "status": status,
        "label": "Half day" if status == AttendanceStatus.HALF_DAY.value else "Leave",
    }


def _format_leave_note(leave_days: list[dict]) -> str | None:
    if not leave_days:
        return None
    parts: list[str] = []
    for row in leave_days:
        day = date.fromisoformat(row["date"][:10])
        kind = "half day" if row.get("status") == AttendanceStatus.HALF_DAY.value else "leave"
        parts.append(f"{day.day} {day.strftime('%b')} ({kind})")
    return f"Leave / half days in this period: {', '.join(parts)}."


def _leave_summary_from_map(
    by_day: dict[date, str],
    start: date,
    end: date,
) -> dict:
    leave_days = [
        _leave_day_payload(day, status)
        for day, status in sorted(by_day.items())
        if start <= day <= end and status in LEAVE_STATUSES
    ]
    working = _working_days(start, end)
    fully_on_leave = bool(working) and all(
        by_day.get(day) == AttendanceStatus.LEAVE.value for day in working
    )
    return {
        "start": start.isoformat(),
        "end": end.isoformat(),
        "leave_days": leave_days,
        "working_day_count": len(working),
        "fully_on_leave": fully_on_leave,
        "suggested_comment": None if fully_on_leave else _format_leave_note(leave_days),
    }


def _snapshot(evaluation: EmployeeEvaluation) -> dict:
    return {
        "status": evaluation.status,
        "overall_comment": evaluation.overall_comment,
        "overall_score": evaluation.overall_score,
        "department_snapshot": evaluation.department_snapshot,
        "submitted_at": evaluation.submitted_at.isoformat() if evaluation.submitted_at else None,
        "evaluator_id": evaluation.evaluator_id,
        "period_start": evaluation.period_start.isoformat(),
        "period_end": _effective_end(evaluation).isoformat(),
        "scores": [
            {
                "parameter_key": row.parameter_key,
                "weight": row.weight,
                "rating": row.rating,
                "weighted_score": row.weighted_score,
                "remarks": row.remarks,
            }
            for row in evaluation.scores
        ],
    }


def _score_rows(evaluation: EmployeeEvaluation) -> list[dict]:
    by_key = {row.parameter_key: row for row in evaluation.scores}
    items = []
    for spec in KRA_PARAMETERS:
        row = by_key.get(spec["key"])
        items.append(
            {
                "parameter_key": spec["key"],
                "name": spec["name"],
                "weight": spec["weight"],
                "rating": row.rating if row else None,
                "weighted_score": row.weighted_score if row else None,
                "remarks": row.remarks if row else None,
            }
        )
    return items


def _view(evaluation: EmployeeEvaluation, include_revisions: bool = False) -> dict:
    employee = evaluation.employee
    period_end = _effective_end(evaluation)
    data = {
        "id": evaluation.id,
        "user_id": evaluation.user_id,
        "employee": _author(employee),
        "departments": _department_names(employee),
        "department_snapshot": evaluation.department_snapshot,
        "period_start": evaluation.period_start.isoformat(),
        "period_end": period_end.isoformat(),
        "status": evaluation.status,
        "overall_comment": evaluation.overall_comment,
        "overall_score": evaluation.overall_score,
        "evaluator": _author(evaluation.evaluator),
        "submitted_at": evaluation.submitted_at,
        "created_at": evaluation.created_at,
        "updated_at": evaluation.updated_at,
        "scores": _score_rows(evaluation),
    }
    if include_revisions:
        data["revisions"] = [
            {
                "id": rev.id,
                "editor": _author(rev.editor),
                "created_at": rev.created_at,
                "snapshot": json.loads(rev.snapshot_json),
            }
            for rev in evaluation.revisions
        ]
    return data


def _normalize_scores(items: list[dict] | None, require_all: bool) -> list[dict]:
    incoming = items or []
    seen: set[str] = set()
    normalized = []
    for item in incoming:
        key = item.get("parameter_key")
        spec = PARAMETER_BY_KEY.get(key)
        if spec is None:
            raise HTTPException(status_code=400, detail="Unknown evaluation parameter")
        if key in seen:
            raise HTTPException(status_code=400, detail="Each parameter can only be rated once")
        seen.add(key)
        rating = item.get("rating")
        if rating is None or rating == "":
            if require_all:
                raise HTTPException(status_code=400, detail=f"Rate {spec['name']} before submitting")
            normalized.append({"parameter_key": key, "weight": spec["weight"], "rating": None, "weighted_score": None, "remarks": item.get("remarks") or None})
            continue
        if isinstance(rating, bool) or not isinstance(rating, int) or rating < 1 or rating > 5:
            raise HTTPException(status_code=400, detail=f"{spec['name']} must be rated from 1 to 5")
        normalized.append(
            {
                "parameter_key": key,
                "weight": spec["weight"],
                "rating": rating,
                "weighted_score": weighted_score(rating, spec["weight"]),
                "remarks": (item.get("remarks") or None),
            }
        )
    if require_all:
        missing = [row["name"] for row in KRA_PARAMETERS if row["key"] not in seen]
        if missing:
            raise HTTPException(status_code=400, detail=f"Rate {missing[0]} before submitting")
    return normalized


def _apply_scores(evaluation: EmployeeEvaluation, scores: list[dict]) -> None:
    by_key = {row.parameter_key: row for row in list(evaluation.scores)}
    incoming = {row["parameter_key"] for row in scores}
    for row in scores:
        existing = by_key.get(row["parameter_key"])
        if existing is None:
            evaluation.scores.append(
                EmployeeEvaluationScore(
                    parameter_key=row["parameter_key"],
                    weight=row["weight"],
                    rating=row["rating"],
                    weighted_score=row["weighted_score"],
                    remarks=row["remarks"],
                )
            )
            continue
        existing.weight = row["weight"]
        existing.rating = row["rating"]
        existing.weighted_score = row["weighted_score"]
        existing.remarks = row["remarks"]
    for key, existing in by_key.items():
        if key not in incoming:
            evaluation.scores.remove(existing)
    rated = {row["parameter_key"]: row["rating"] for row in scores if row["rating"] is not None}
    if len(rated) == len(KRA_PARAMETERS):
        evaluation.overall_score = overall_score(rated)
    else:
        evaluation.overall_score = None


def _same_content(evaluation: EmployeeEvaluation, comment: str | None, scores: list[dict]) -> bool:
    current = {
        row.parameter_key: (row.rating, (row.remarks or "").strip())
        for row in evaluation.scores
    }
    incoming = {
        row["parameter_key"]: (row["rating"], (row["remarks"] or "").strip())
        for row in scores
    }
    return current == incoming and (evaluation.overall_comment or "") == (comment or "")


def _period_list_item(row: EmployeeEvaluation) -> dict:
    return {
        "evaluation_id": row.id,
        "period_start": row.period_start.isoformat(),
        "period_end": _effective_end(row).isoformat(),
        "overall_score": row.overall_score if row.status == "submitted" else None,
        "status": row.status,
        "evaluator": _author(row.evaluator),
        "submitted_at": row.submitted_at,
    }


class EvaluationService:
    def __init__(self, db: Session):
        self.db = db

    def scorecard(self) -> dict:
        return {"parameters": list(KRA_PARAMETERS), "rating_scale": list(RATING_SCALE)}

    def _active_users(self, department_id: int | None, user_id: int | None) -> list[User]:
        query = (
            self.db.query(User)
            .options(joinedload(User.departments))
            .filter(User.status == "active")
            .order_by(User.first_name.asc(), User.last_name.asc())
        )
        if user_id is not None:
            query = query.filter(User.id == user_id)
        users = list({user.id: user for user in query.all()}.values())
        users.sort(key=lambda user: (user.first_name, user.last_name))
        if department_id is None:
            return users
        return [user for user in users if any(d.id == department_id for d in (user.departments or []))]

    def list_evaluations(
        self,
        period: date,
        department_id: int | None = None,
        user_id: int | None = None,
    ) -> dict:
        month = month_start(period)
        month_end = calendar_month_end(month)
        users = self._active_users(department_id, user_id)
        user_ids = [user.id for user in users]
        rows: list[EmployeeEvaluation] = []
        if user_ids:
            rows = (
                self.db.query(EmployeeEvaluation)
                .options(joinedload(EmployeeEvaluation.evaluator))
                .filter(
                    EmployeeEvaluation.user_id.in_(user_ids),
                    EmployeeEvaluation.period_start >= month,
                    EmployeeEvaluation.period_start <= month_end,
                )
                .order_by(EmployeeEvaluation.period_start.asc(), EmployeeEvaluation.id.asc())
                .all()
            )
        by_user: dict[int, list[EmployeeEvaluation]] = {uid: [] for uid in user_ids}
        last_submitted: dict[int, datetime] = {}
        for row in rows:
            by_user.setdefault(row.user_id, []).append(row)
        # Last submitted across all months (for the column).
        if user_ids:
            all_rows = (
                self.db.query(EmployeeEvaluation)
                .filter(EmployeeEvaluation.user_id.in_(user_ids), EmployeeEvaluation.status == "submitted")
                .all()
            )
            for row in all_rows:
                if row.submitted_at:
                    previous = last_submitted.get(row.user_id)
                    if previous is None or row.submitted_at > previous:
                        last_submitted[row.user_id] = row.submitted_at

        leave_by_user = self._leave_maps(user_ids, month, month_end)

        items = []
        for user in users:
            month_rows = by_user.get(user.id, [])
            submitted = [r for r in month_rows if r.status == "submitted" and r.overall_score is not None]
            drafts = [r for r in month_rows if r.status == "draft"]
            if submitted:
                avg = round(sum(r.overall_score for r in submitted) / len(submitted), 2)
                status = "submitted" if not drafts else "partial"
            elif drafts:
                avg = None
                status = "draft"
            else:
                avg = None
                status = "not_started"
            leave_summary = _leave_summary_from_map(leave_by_user.get(user.id, {}), month, month_end)
            items.append(
                {
                    "user_id": user.id,
                    "name": user.full_name,
                    "departments": _department_names(user),
                    "period_start": month.isoformat(),
                    "period_end": month_end.isoformat(),
                    "monthly_average": avg,
                    "evaluation_count": len(month_rows),
                    "submitted_count": len(submitted),
                    "overall_score": avg,
                    "status": status,
                    "last_evaluated_at": last_submitted.get(user.id),
                    "evaluations": [_period_list_item(r) for r in month_rows],
                    "leave_days": leave_summary["leave_days"],
                    "leave_summary": leave_summary,
                    # Backward-compatible single-id field: prefer latest submitted, else latest any.
                    "evaluation_id": (
                        (submitted[-1].id if submitted else None)
                        or (month_rows[-1].id if month_rows else None)
                    ),
                    "evaluator": _author(submitted[-1].evaluator) if submitted else (
                        _author(month_rows[-1].evaluator) if month_rows else None
                    ),
                }
            )
        return {
            "period_start": month.isoformat(),
            "period_end": month_end.isoformat(),
            **self.scorecard(),
            "items": items,
        }

    def leave_context(self, user_id: int, period_start: date, period_end: date | None = None) -> dict:
        employee = self._employee(user_id)
        start, end = self._validate_period_range(period_start, period_end)
        maps = self._leave_maps([employee.id], start, end)
        return {
            "user_id": employee.id,
            **_leave_summary_from_map(maps.get(employee.id, {}), start, end),
        }

    def get(self, evaluation_id: int) -> dict:
        evaluation = self._get(evaluation_id)
        return _view(evaluation, include_revisions=True)

    def history(self, user_id: int) -> dict:
        user = self.db.query(User).options(joinedload(User.departments)).filter(User.id == user_id).first()
        if user is None:
            raise HTTPException(status_code=404, detail="Employee not found")
        rows = (
            self.db.query(EmployeeEvaluation)
            .options(
                joinedload(EmployeeEvaluation.employee).joinedload(User.departments),
                joinedload(EmployeeEvaluation.evaluator),
                joinedload(EmployeeEvaluation.scores),
                joinedload(EmployeeEvaluation.revisions).joinedload(EmployeeEvaluationRevision.editor),
            )
            .filter(EmployeeEvaluation.user_id == user_id)
            .order_by(EmployeeEvaluation.period_start.asc(), EmployeeEvaluation.id.asc())
            .all()
        )
        rows = list({row.id: row for row in rows}.values())
        rows.sort(key=lambda row: (row.period_start, _effective_end(row), row.id))
        return {
            "user": {**(_author(user) or {}), "departments": _department_names(user)},
            "evaluations": [_view(row, include_revisions=True) for row in rows],
        }

    def create_draft(self, actor: User, payload: dict) -> dict:
        employee = self._employee(payload.get("user_id"))
        period_start, period_end = self._validate_period_range(
            payload.get("period_start"),
            payload.get("period_end"),
        )
        self._assert_no_overlap(employee.id, period_start, period_end)
        self._assert_not_fully_on_leave(employee.id, period_start, period_end)
        scores = _normalize_scores(payload.get("scores"), require_all=False)
        evaluation = EmployeeEvaluation(
            user_id=employee.id,
            period_start=period_start,
            period_end=period_end,
            evaluator_id=actor.id,
            status="draft",
            overall_comment=(payload.get("overall_comment") or None),
            department_snapshot=", ".join(_department_names(employee)) or None,
        )
        _apply_scores(evaluation, scores)
        self.db.add(evaluation)
        try:
            self.db.commit()
        except IntegrityError:
            self.db.rollback()
            raise HTTPException(
                status_code=409,
                detail="An evaluation already exists for this employee and period",
            )
        return self.get(evaluation.id)

    def save_draft(self, actor: User, evaluation_id: int, payload: dict) -> dict:
        evaluation = self._get(evaluation_id)
        self._write(actor, evaluation, payload, submit=False)
        self.db.commit()
        return self.get(evaluation.id)

    def submit(self, actor: User, evaluation_id: int, payload: dict) -> dict:
        evaluation = self._get(evaluation_id)
        self._write(actor, evaluation, payload, submit=True)
        self.db.commit()
        return self.get(evaluation.id)

    def _write(self, actor: User, evaluation: EmployeeEvaluation, payload: dict, submit: bool) -> None:
        scores = _normalize_scores(payload.get("scores"), require_all=submit)
        comment = payload.get("overall_comment") or None
        unchanged_resubmit = submit and _same_content(evaluation, comment, scores)
        if evaluation.status == "submitted" and not unchanged_resubmit:
            self.db.add(
                EmployeeEvaluationRevision(
                    evaluation_id=evaluation.id,
                    editor_id=actor.id,
                    snapshot_json=json.dumps(_snapshot(evaluation)),
                )
            )
        # Allow period edits on drafts when provided.
        if evaluation.status != "submitted" and (
            payload.get("period_start") is not None or payload.get("period_end") is not None
        ):
            start, end = self._validate_period_range(
                payload.get("period_start") or evaluation.period_start,
                payload.get("period_end") or evaluation.period_end,
            )
            self._assert_no_overlap(evaluation.user_id, start, end, exclude_id=evaluation.id)
            evaluation.period_start = start
            evaluation.period_end = end
        elif evaluation.period_end is None:
            evaluation.period_end = calendar_month_end(evaluation.period_start)

        self._assert_not_fully_on_leave(
            evaluation.user_id,
            evaluation.period_start,
            _effective_end(evaluation),
        )

        employee = evaluation.employee
        evaluation.overall_comment = comment
        evaluation.department_snapshot = ", ".join(_department_names(employee)) or None
        evaluation.evaluator_id = actor.id
        _apply_scores(evaluation, scores)
        if submit:
            evaluation.status = "submitted"
            if evaluation.submitted_at is None:
                evaluation.submitted_at = datetime.now(timezone.utc)
        elif evaluation.status == "submitted":
            evaluation.status = "draft"

    def _leave_maps(
        self,
        user_ids: list[int],
        start: date,
        end: date,
    ) -> dict[int, dict[date, str]]:
        if not user_ids:
            return {}
        rows = (
            self.db.query(Attendance)
            .filter(
                Attendance.user_id.in_(user_ids),
                Attendance.attendance_date >= start,
                Attendance.attendance_date <= end,
                Attendance.status.in_(tuple(LEAVE_STATUSES)),
            )
            .all()
        )
        by_user: dict[int, dict[date, str]] = {uid: {} for uid in user_ids}
        for row in rows:
            by_user.setdefault(row.user_id, {})[row.attendance_date] = row.status
        return by_user

    def _assert_not_fully_on_leave(self, user_id: int, period_start: date, period_end: date) -> None:
        summary = _leave_summary_from_map(
            self._leave_maps([user_id], period_start, period_end).get(user_id, {}),
            period_start,
            period_end,
        )
        if summary["fully_on_leave"]:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Cannot evaluate this period — the employee was on leave "
                    "for every working day in the selected range"
                ),
            )

    def _assert_no_overlap(
        self,
        user_id: int,
        period_start: date,
        period_end: date,
        exclude_id: int | None = None,
    ) -> None:
        rows = (
            self.db.query(EmployeeEvaluation)
            .filter(EmployeeEvaluation.user_id == user_id)
            .all()
        )
        for row in rows:
            if exclude_id is not None and row.id == exclude_id:
                continue
            existing_end = _effective_end(row)
            if _ranges_overlap(period_start, period_end, row.period_start, existing_end):
                raise HTTPException(
                    status_code=409,
                    detail=(
                        "This period overlaps an existing evaluation "
                        f"({row.period_start.isoformat()} – {existing_end.isoformat()})"
                    ),
                )

    def _validate_period_range(self, raw_start, raw_end) -> tuple[date, date]:
        start = self._parse_date(raw_start, "Select an evaluation period start")
        if raw_end is None or raw_end == "":
            # Backward compatible: month-start alone means the full calendar month.
            if start.day == 1:
                end = calendar_month_end(start)
            else:
                raise HTTPException(status_code=400, detail="Select an evaluation period end")
        else:
            end = self._parse_date(raw_end, "Select an evaluation period end")

        if end < start:
            raise HTTPException(status_code=400, detail="Period end must be on or after the start date")
        if start.year != end.year or start.month != end.month:
            raise HTTPException(
                status_code=400,
                detail="Evaluation period must stay within a single calendar month",
            )
        span_days = (end - start).days + 1
        max_days = calendar_month_end(start).day
        if span_days < MIN_PERIOD_DAYS:
            raise HTTPException(
                status_code=400,
                detail=f"Evaluation period must be at least {MIN_PERIOD_DAYS} days",
            )
        if span_days > max_days:
            raise HTTPException(
                status_code=400,
                detail="Evaluation period cannot exceed one calendar month",
            )
        if end > calendar_month_end(start):
            raise HTTPException(
                status_code=400,
                detail="Evaluation period must stay within a single calendar month",
            )
        return start, end

    def _get(self, evaluation_id: int) -> EmployeeEvaluation:
        evaluation = (
            self.db.query(EmployeeEvaluation)
            .options(
                joinedload(EmployeeEvaluation.employee).joinedload(User.departments),
                joinedload(EmployeeEvaluation.evaluator),
                joinedload(EmployeeEvaluation.scores),
                joinedload(EmployeeEvaluation.revisions).joinedload(EmployeeEvaluationRevision.editor),
            )
            .filter(EmployeeEvaluation.id == evaluation_id)
            .first()
        )
        if evaluation is None:
            raise HTTPException(status_code=404, detail="Evaluation not found")
        return evaluation

    def _employee(self, user_id: int | None) -> User:
        if not user_id:
            raise HTTPException(status_code=400, detail="Select an employee")
        user = (
            self.db.query(User)
            .options(joinedload(User.departments))
            .filter(User.id == user_id, User.status == "active")
            .first()
        )
        if user is None:
            raise HTTPException(status_code=404, detail="Employee not found")
        return user

    def _parse_date(self, raw, error: str) -> date:
        if raw is None:
            raise HTTPException(status_code=400, detail=error)
        if isinstance(raw, datetime):
            return raw.date()
        if isinstance(raw, date):
            return raw
        text = str(raw)
        if len(text) == 7:
            text = f"{text}-01"
        try:
            return date.fromisoformat(text[:10])
        except ValueError:
            raise HTTPException(status_code=400, detail=error)
