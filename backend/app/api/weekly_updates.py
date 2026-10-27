from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.database import get_db
from app.models import User
from app.schemas.common import APIResponse
from app.schemas.weekly_update import WeeklyReportUpsert
from app.services.weekly_update_service import WeeklyUpdateService

router = APIRouter(prefix="/weekly-updates", tags=["weekly-updates"])


@router.get("/overview")
def get_overview(
    week_start: date | None = Query(None),
    department_id: int | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    data = WeeklyUpdateService(db).overview(department_id=department_id, period_start=week_start)
    return APIResponse(data=data)


@router.get("/employees")
def get_employees(
    week_start: date | None = Query(None),
    department_id: int | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    data = WeeklyUpdateService(db).employees(department_id=department_id, period_start=week_start)
    return APIResponse(data=data)


@router.get("/suggestions")
def get_suggestions(
    week_start: date | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    data = WeeklyUpdateService(db).suggestions(current_user, period_start=week_start)
    return APIResponse(data=data)


@router.get("/carry-forward")
def get_carry_forward(
    week_start: date | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    data = WeeklyUpdateService(db).carry_forward(current_user, period_start=week_start)
    return APIResponse(data=data)


@router.get("/leave-context")
def get_leave_context(
    week_start: date | None = Query(None),
    user_id: int | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    target = current_user
    if user_id is not None:
        target = db.query(User).filter(User.id == user_id).first() or current_user
    data = WeeklyUpdateService(db).get_leave_context(target, period_start=week_start)
    return APIResponse(data=data)


@router.get("/users/{user_id}")
def get_user_history(
    user_id: int,
    week_start: date | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    data = WeeklyUpdateService(db).user_history(user_id, week_start=week_start)
    return APIResponse(data=data)


@router.put("")
def upsert_weekly_update(
    body: WeeklyReportUpsert,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    data = WeeklyUpdateService(db).upsert(current_user, body.model_dump())
    message = "Weekly update saved"
    if data.get("create_errors"):
        message = "Weekly update saved with some task-creation errors"
    return APIResponse(data=data, message=message)
