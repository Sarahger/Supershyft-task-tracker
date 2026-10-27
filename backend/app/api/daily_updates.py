from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.database import get_db
from app.models import User
from app.schemas.common import APIResponse
from app.schemas.daily_update import (
    CalendarResponse,
    DailyUpdateDayResponse,
    DailyUpdateResponse,
    DailyUpdateUpsert,
)
from app.services.daily_update_service import DailyUpdateService

router = APIRouter(prefix="/daily-updates", tags=["daily-updates"])


@router.get("/day", response_model=APIResponse[DailyUpdateDayResponse])
def get_day(
    date_value: date = Query(..., alias="date"),
    user_id: int | None = Query(None, description="Manager filter: show only this user's update"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    data = DailyUpdateService(db).get_day(current_user, date_value, filter_user_id=user_id)
    return APIResponse(data=DailyUpdateDayResponse(**data))


@router.get("/calendar", response_model=APIResponse[CalendarResponse])
def get_calendar(
    year: int = Query(...),
    month: int = Query(..., ge=1, le=12),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    data = DailyUpdateService(db).get_calendar(current_user, year, month)
    return APIResponse(data=CalendarResponse(**data))


@router.put("", response_model=APIResponse[DailyUpdateResponse])
def upsert_daily_update(
    body: DailyUpdateUpsert,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    data = DailyUpdateService(db).upsert(
        current_user,
        body.update_date,
        body.content,
        body.task_ids,
        body.mentioned_user_ids,
    )
    return APIResponse(data=DailyUpdateResponse(**data), message="Daily update saved")
