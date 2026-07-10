from datetime import date, datetime

from pydantic import BaseModel, Field


class MeetingJoinRequest(BaseModel):
    kind: str = Field(..., pattern="^(morning|quick|task)$")
    task_id: int | None = None


class MeetingLeaveRequest(BaseModel):
    log_id: int | None = None


class MeetingDaySettingUpdate(BaseModel):
    meeting_date: date
    morning_call_enabled: bool


class MeetingLogUserBrief(BaseModel):
    id: int
    first_name: str
    last_name: str


class MeetingLogResponse(BaseModel):
    id: int
    user_id: int
    task_id: int | None
    task_title: str | None = None
    click_time: datetime
    left_at: datetime | None
    log_type: str
    status: str | None
    user: MeetingLogUserBrief | None = None


class MeetingJoinResponse(BaseModel):
    redirect_url: str
    log: MeetingLogResponse


class MeetingDayResponse(BaseModel):
    date: date
    morning_call_enabled: bool
    morning_call_join_available: bool
    meet_url: str
    my_logs: list[MeetingLogResponse]
    late_arrivals: list[MeetingLogResponse]
    task_calls: list[MeetingLogResponse]
