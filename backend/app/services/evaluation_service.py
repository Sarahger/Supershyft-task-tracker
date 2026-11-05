"""Monthly KRA/KPI evaluations. The backend owns the weighted score."""

from __future__ import annotations

import json
from datetime import date, datetime, timezone

from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.core.kra_scorecard import (
    KRA_PARAMETERS,
    PARAMETER_BY_KEY,
    RATING_SCALE,
    overall_score,
    weighted_score,
)
from app.models import EmployeeEvaluation, EmployeeEvaluationRevision, EmployeeEvaluationScore, User


def month_start(value: date) -> date:
    start = value.replace(day=1)
    if value != start:
        raise HTTPException(status_code=400, detail="Evaluation period must be the first day of a month")
    return start


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


def _snapshot(evaluation: EmployeeEvaluation) -> dict:
    return {
        "status": evaluation.status,
        "overall_comment": evaluation.overall_comment,
        "overall_score": evaluation.overall_score,
        "department_snapshot": evaluation.department_snapshot,
        "submitted_at": evaluation.submitted_at.isoformat() if evaluation.submitted_at else None,
        "evaluator_id": evaluation.evaluator_id,
        "period_start": evaluation.period_start.isoformat(),
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
    data = {
        "id": evaluation.id,
        "user_id": evaluation.user_id,
        "employee": _author(employee),
        "departments": _department_names(employee),
        "department_snapshot": evaluation.department_snapshot,
        "period_start": evaluation.period_start.isoformat(),
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
        period = month_start(period)
        users = self._active_users(department_id, user_id)
        user_ids = [user.id for user in users]
        rows = []
        if user_ids:
            rows = (
                self.db.query(EmployeeEvaluation)
                .options(joinedload(EmployeeEvaluation.evaluator))
                .filter(EmployeeEvaluation.user_id.in_(user_ids))
                .all()
            )
        current = {row.user_id: row for row in rows if row.period_start == period}
        last_submitted: dict[int, datetime] = {}
        for row in rows:
            if row.status == "submitted" and row.submitted_at:
                previous = last_submitted.get(row.user_id)
                if previous is None or row.submitted_at > previous:
                    last_submitted[row.user_id] = row.submitted_at
        items = []
        for user in users:
            row = current.get(user.id)
            items.append(
                {
                    "user_id": user.id,
                    "name": user.full_name,
                    "departments": _department_names(user),
                    "evaluation_id": row.id if row else None,
                    "period_start": period.isoformat(),
                    "overall_score": row.overall_score if row and row.status == "submitted" else None,
                    "status": row.status if row else "not_started",
                    "last_evaluated_at": last_submitted.get(user.id),
                    "evaluator": _author(row.evaluator) if row else None,
                }
            )
        return {"period_start": period.isoformat(), **self.scorecard(), "items": items}

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
            .order_by(EmployeeEvaluation.period_start.asc())
            .all()
        )
        rows = list({row.id: row for row in rows}.values())
        rows.sort(key=lambda row: row.period_start)
        return {
            "user": {**(_author(user) or {}), "departments": _department_names(user)},
            "evaluations": [_view(row, include_revisions=True) for row in rows],
        }

    def create_draft(self, actor: User, payload: dict) -> dict:
        employee = self._employee(payload.get("user_id"))
        period = month_start(self._period(payload.get("period_start")))
        scores = _normalize_scores(payload.get("scores"), require_all=False)
        evaluation = EmployeeEvaluation(
            user_id=employee.id,
            period_start=period,
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
                detail="An evaluation already exists for this employee and month",
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

    def _period(self, raw) -> date:
        if raw is None:
            raise HTTPException(status_code=400, detail="Select an evaluation month")
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
            raise HTTPException(status_code=400, detail="Select an evaluation month")
