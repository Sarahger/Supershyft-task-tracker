from datetime import date, datetime

from pydantic import BaseModel, Field


class MeetingLeaveRequest(BaseModel):
    log_id: int | None = None


class InstantCallStartRequest(BaseModel):
    invite_user_ids: list[int] = Field(default_factory=list)


class EndCallRequest(BaseModel):
    pool_id: int


class MeetingLogUserBrief(BaseModel):
    id: int
    first_name: str
    last_name: str


class MeetPoolResponse(BaseModel):
    id: int
    meet_url: str
    is_occupied: bool
    current_context_id: str | None
    meeting_type: str | None
    last_occupied_at: datetime | None


class MeetingLogResponse(BaseModel):
    id: int
    user_id: int
    task_id: int | None
    task_title: str | None = None
    click_time: datetime
    left_at: datetime | None
    log_type: str
    status: str | None
    meet_url: str | None = None
    pool_id: int | None = None
    user: MeetingLogUserBrief | None = None


class MeetingActionResponse(BaseModel):
    redirect_url: str | None = None
    log: MeetingLogResponse | None = None
    pool: MeetPoolResponse | None = None


class MeetingDayResponse(BaseModel):
    date: date
    morning_call_join_available: bool
    morning_meet_url: str
    my_logs: list[MeetingLogResponse]
    morning_attendance: list[MeetingLogResponse]
    task_calls: list[MeetingLogResponse]
    general_calls: list[MeetingLogResponse]
    active_instant_call: MeetPoolResponse | None = None
    pool_available_count: int = 0
