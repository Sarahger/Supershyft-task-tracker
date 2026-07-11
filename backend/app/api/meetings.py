from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.constants import UserRole
from app.core.dependencies import get_current_user, require_manager
from app.db.database import get_db
from app.models import User
from app.schemas.common import APIResponse
from app.schemas.meeting import (
    EndCallRequest,
    InstantCallStartRequest,
    MeetingActionResponse,
    MeetingDayResponse,
    MeetingLeaveRequest,
    MeetingLogResponse,
    MeetPoolResponse,
)
from app.services.meeting_service import MeetingService

router = APIRouter(prefix="/meetings", tags=["meetings"])


def _is_manager(user: User) -> bool:
    return user.role in (UserRole.ADMIN.value, UserRole.MANAGER.value)


@router.post("/morning/join")
def join_morning_call(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = MeetingService(db).join_morning_call(current_user)
    return APIResponse(data=MeetingActionResponse(**result))


@router.post("/instant/start")
def start_instant_general_call(
    data: InstantCallStartRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = MeetingService(db).start_instant_general_call(current_user, data.invite_user_ids)
    return APIResponse(data=MeetingActionResponse(**result))


@router.post("/instant/end")
def end_instant_call(
    data: EndCallRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = MeetingService(db).end_instant_call(current_user, data.pool_id)
    return APIResponse(data=result)


@router.post("/task/{task_id}/start")
def start_task_call(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = MeetingService(db).start_task_call(current_user, task_id)
    return APIResponse(data=MeetingActionResponse(**result))


@router.post("/task/{task_id}/join")
def join_task_call(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = MeetingService(db).join_task_call(current_user, task_id)
    return APIResponse(data=MeetingActionResponse(**result))


@router.post("/task/{task_id}/end")
def end_task_call(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = MeetingService(db).end_task_call(current_user, task_id)
    return APIResponse(data=result)


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


@router.get("/task/{task_id}")
def get_task_meeting_logs(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    logs = MeetingService(db).get_task_logs(task_id)
    return APIResponse(data=[MeetingLogResponse(**l) for l in logs])


@router.get("/task/{task_id}/active")
def get_active_task_call(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    pool = MeetingService(db).get_active_task_call(task_id)
    return APIResponse(data=MeetPoolResponse(**pool) if pool else None)
