from datetime import date

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.dependencies import require_manager
from app.db.database import get_db
from app.models import User
from app.schemas.common import APIResponse
from app.services.evaluation_service import EvaluationService
from app.services.report_analytics_service import build_analytics

router = APIRouter(prefix="/reports", tags=["reports"])


class EvaluationScoreIn(BaseModel):
    parameter_key: str
    rating: int | None = None
    remarks: str | None = None


class EvaluationWrite(BaseModel):
    user_id: int | None = None
    period_start: date | None = None
    overall_comment: str | None = Field(None, max_length=4000)
    scores: list[EvaluationScoreIn] = []


@router.get("/analytics")
def report_analytics(
    start_date: date = Query(...),
    end_date: date = Query(...),
    department_id: int | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager),
):
    data = build_analytics(db, start_date, end_date, department_id)
    return APIResponse(data=data)


@router.get("/evaluations")
def list_evaluations(
    period_start: date = Query(...),
    department_id: int | None = Query(None),
    user_id: int | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager),
):
    data = EvaluationService(db).list_evaluations(period_start, department_id, user_id)
    return APIResponse(data=data)


@router.get("/evaluations/scorecard")
def scorecard(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager),
):
    return APIResponse(data=EvaluationService(db).scorecard())


@router.get("/evaluations/history")
def evaluation_history(
    user_id: int = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager),
):
    return APIResponse(data=EvaluationService(db).history(user_id))


@router.post("/evaluations")
def create_evaluation(
    payload: EvaluationWrite,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager),
):
    data = EvaluationService(db).create_draft(current_user, payload.model_dump())
    return APIResponse(data=data, message="Draft saved")


@router.get("/evaluations/{evaluation_id}")
def get_evaluation(
    evaluation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager),
):
    return APIResponse(data=EvaluationService(db).get(evaluation_id))


@router.put("/evaluations/{evaluation_id}")
def save_evaluation_draft(
    evaluation_id: int,
    payload: EvaluationWrite,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager),
):
    data = EvaluationService(db).save_draft(current_user, evaluation_id, payload.model_dump())
    return APIResponse(data=data, message="Draft saved")


@router.post("/evaluations/{evaluation_id}/submit")
def submit_evaluation(
    evaluation_id: int,
    payload: EvaluationWrite,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager),
):
    data = EvaluationService(db).submit(current_user, evaluation_id, payload.model_dump())
    return APIResponse(data=data, message="Evaluation submitted")
