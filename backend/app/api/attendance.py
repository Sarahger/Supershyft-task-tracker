import csv
import io
import logging
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, require_manager
from app.db.database import get_db
from app.models import User
from app.schemas.attendance import (
    AttendanceDayResponse,
    AttendanceExportFilter,
    AttendanceListResponse,
    AttendanceMarkRequest,
    AttendanceMeResponse,
    AttendanceRecordResponse,
    AttendanceUserDetailResponse,
    AttendanceWeekResponse,
)
from app.schemas.common import APIResponse
from app.services.attendance_service import AttendanceService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/attendance", tags=["attendance"])


@router.post("", response_model=APIResponse[AttendanceRecordResponse])
def mark_attendance(
    body: AttendanceMarkRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    data = AttendanceService(db).upsert(
        current_user,
        body.status,
        attendance_date=body.attendance_date,
    )
    return APIResponse(data=AttendanceRecordResponse(**data), message="Attendance saved")


@router.get("/me/today", response_model=APIResponse[AttendanceRecordResponse | None])
def get_my_today(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    data = AttendanceService(db).get_today(current_user)
    return APIResponse(data=AttendanceRecordResponse(**data) if data else None)


@router.get("/me", response_model=APIResponse[AttendanceMeResponse])
def get_my_attendance(
    month: int | None = Query(None, ge=1, le=12),
    year: int | None = Query(None, ge=2000, le=2100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    data = AttendanceService(db).get_me(current_user, month=month, year=year)
    return APIResponse(data=AttendanceMeResponse(**data))


@router.get("/week", response_model=APIResponse[AttendanceWeekResponse])
def get_week_dashboard(
    week_start: date | None = Query(None),
    department_id: int | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager),
):
    data = AttendanceService(db).get_week(week_start=week_start, department_id=department_id)
    return APIResponse(data=AttendanceWeekResponse(**data))


@router.get("/day", response_model=APIResponse[AttendanceDayResponse])
def get_day_overview(
    day: date | None = Query(None, description="Calendar day in company timezone. Defaults to today."),
    department_id: int | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager),
):
    data = AttendanceService(db).get_day(day=day, department_id=department_id)
    return APIResponse(data=AttendanceDayResponse(**data))


@router.get("/users/{user_id}", response_model=APIResponse[AttendanceUserDetailResponse])
def get_user_attendance(
    user_id: int,
    month: int | None = Query(None, ge=1, le=12),
    year: int | None = Query(None, ge=2000, le=2100),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager),
):
    data = AttendanceService(db).get_user_detail(user_id, month=month, year=year)
    return APIResponse(data=AttendanceUserDetailResponse(**data))


@router.post("/export/csv")
def export_csv(
    filters: AttendanceExportFilter,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager),
):
    rows = AttendanceService(db).export_rows(
        month=filters.month,
        year=filters.year,
        user_id=filters.user_id,
        department_id=filters.department_id,
        status=filters.status,
    )
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerows(rows)
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=attendance_export.csv"},
    )


@router.get("", response_model=APIResponse[AttendanceListResponse])
def list_attendance(
    month: int | None = Query(None, ge=1, le=12),
    year: int | None = Query(None, ge=2000, le=2100),
    user_id: int | None = Query(None),
    department_id: int | None = Query(None),
    status: str = Query("ALL"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager),
):
    allowed = {"WFO", "WFH", "LEAVE", "HALF_DAY", "CAMP", "NOT_MARKED", "ALL"}
    if status not in allowed:
        raise HTTPException(status_code=400, detail="Invalid status filter")
    data = AttendanceService(db).get_list(
        month=month,
        year=year,
        user_id=user_id,
        department_id=department_id,
        status=status,
    )
    return APIResponse(data=AttendanceListResponse(**data))
