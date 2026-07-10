from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.constants import UserRole
from app.core.dependencies import get_current_user, require_manager
from app.db.database import get_db
from app.models import User
from app.schemas.common import APIResponse
from app.schemas.meeting import MeetingDayResponse, MeetingDaySettingUpdate, MeetingJoinRequest, MeetingJoinResponse, MeetingLeaveRequest, MeetingLogResponse
from app.services.meeting_service import MeetingService

router = APIRouter(prefix="/meetings", tags=["meetings"])


def _is_manager(user: User) -> bool:
    return user.role in (UserRole.ADMIN.value, UserRole.MANAGER.value)


@router.post("/join")
def join_meeting(
    data: MeetingJoinRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = MeetingService(db).join_meeting(current_user, data.kind, data.task_id)
    return APIResponse(data=MeetingJoinResponse(**result))


@router.post("/leave")
def leave_meeting(
    data: MeetingLeaveRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    log = MeetingService(db).record_leave(current_user, data.log_id)
    return APIResponse(data=MeetingLogResponse(**log))


@router.get("/day")
def get_meeting_day(
    date: date = Query(..., alias="date"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    summary = MeetingService(db).get_day_summary(current_user, date, _is_manager(current_user))
    return APIResponse(data=MeetingDayResponse(**summary))


@router.put("/day-settings", dependencies=[Depends(require_manager)])
def update_day_settings(
    data: MeetingDaySettingUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = MeetingService(db).set_morning_call_enabled(
        data.meeting_date, data.morning_call_enabled, current_user
    )
    return APIResponse(data=result)


@router.get("/task/{task_id}")
def get_task_meeting_logs(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    logs = MeetingService(db).get_task_logs(task_id)
    return APIResponse(data=[MeetingLogResponse(**l) for l in logs])
