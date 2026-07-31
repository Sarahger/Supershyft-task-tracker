from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field


AttendanceStatusValue = Literal["WFO", "WFH", "LEAVE", "HALF_DAY", "CAMP"]
AttendanceFilterValue = Literal["WFO", "WFH", "LEAVE", "HALF_DAY", "CAMP", "NOT_MARKED", "ALL"]


class AttendanceMarkRequest(BaseModel):
    status: AttendanceStatusValue
    attendance_date: date | None = Field(
        None,
        description="Calendar day in company timezone. Defaults to today. Only today and yesterday allowed.",
    )


class AttendanceUserBrief(BaseModel):
    id: int
    first_name: str
    last_name: str
    profile_picture: str | None = None
    job_title: str | None = None
    role: str | None = None
    departments: list[str] = []

    model_config = {"from_attributes": True}


class AttendanceRecordResponse(BaseModel):
    id: int
    user_id: int
    attendance_date: date
    status: AttendanceStatusValue
    recorded_at: datetime
    created_at: datetime
    editable: bool = False
    user: AttendanceUserBrief | None = None

    model_config = {"from_attributes": True}


class AttendanceSummary(BaseModel):
    wfo_count: int = 0
    wfh_count: int = 0
    leave_count: int = 0
    half_day_count: int = 0
    camp_count: int = 0
    present_count: int = 0
    total_marked: int = 0
    working_days: int = 0
    attendance_percent: float = 0.0
    late_count: int = 0


class AttendanceMeResponse(BaseModel):
    year: int
    month: int
    today: date
    today_record: AttendanceRecordResponse | None = None
    records: list[AttendanceRecordResponse]
    summary: AttendanceSummary
    week: list[AttendanceRecordResponse | None] = Field(
        default_factory=list,
        description="Mon–Sun of the current week; None = not marked",
    )


class AttendanceTodayPeople(BaseModel):
    present_wfo: list[AttendanceUserBrief] = Field(default_factory=list)
    wfh: list[AttendanceUserBrief] = Field(default_factory=list)
    on_leave: list[AttendanceUserBrief] = Field(default_factory=list)
    half_day: list[AttendanceUserBrief] = Field(default_factory=list)
    camp: list[AttendanceUserBrief] = Field(default_factory=list)
    not_marked: list[AttendanceUserBrief] = Field(default_factory=list)


class AttendanceTodayStats(BaseModel):
    present_wfo: int = 0
    wfh: int = 0
    on_leave: int = 0
    half_day: int = 0
    camp: int = 0
    not_marked: int = 0
    total_active: int = 0
    people: AttendanceTodayPeople = Field(default_factory=AttendanceTodayPeople)


class AttendanceListResponse(BaseModel):
    records: list[AttendanceRecordResponse]
    today_stats: AttendanceTodayStats
    year: int
    month: int


class AttendanceWeekDayCell(BaseModel):
    date: date
    status: AttendanceStatusValue | None = None
    recorded_at: datetime | None = None


class AttendanceWeekRow(BaseModel):
    user: AttendanceUserBrief
    days: list[AttendanceWeekDayCell]


class AttendanceWeekResponse(BaseModel):
    week_start: date
    week_end: date
    rows: list[AttendanceWeekRow]


class AttendanceUserDetailResponse(BaseModel):
    user: AttendanceUserBrief
    year: int
    month: int
    records: list[AttendanceRecordResponse]
    summary: AttendanceSummary


class AttendanceExportFilter(BaseModel):
    user_id: int | None = None
    department_id: int | None = None
    month: int | None = Field(None, ge=1, le=12)
    year: int | None = Field(None, ge=2000, le=2100)
    status: AttendanceFilterValue = "ALL"
