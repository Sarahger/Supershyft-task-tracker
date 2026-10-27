from datetime import date, datetime

from pydantic import BaseModel, Field


class WeeklyAuthor(BaseModel):
    id: int
    first_name: str
    last_name: str
    profile_picture: str | None = None
    job_title: str | None = None

    model_config = {"from_attributes": True}


class WeeklyDepartment(BaseModel):
    id: int
    name: str


class WeeklyCompletionIn(BaseModel):
    task_id: int | None = None
    title: str = Field(..., min_length=1, max_length=500)
    completion_date: date | None = None
    source: str = "manual"
    included: bool = True


class WeeklyCommitmentIn(BaseModel):
    task_id: int | None = None
    title: str = Field(..., min_length=1, max_length=500)
    description: str | None = None
    estimated_hours: float = Field(..., gt=0)
    due_date: datetime
    commitment_type: str = "new"
    revision_reason: str | None = None


class WeeklyReportUpsert(BaseModel):
    period_start: date
    leave_notes: str | None = Field(None, max_length=4000)
    completions: list[WeeklyCompletionIn] = []
    commitments: list[WeeklyCommitmentIn] = []


class DeadlineRevisionCreate(BaseModel):
    reason: str = Field(..., min_length=1, max_length=4000)
    new_due_date: datetime
    weekly_report_id: int | None = None
