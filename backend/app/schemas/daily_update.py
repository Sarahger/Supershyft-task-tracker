from datetime import date, datetime

from pydantic import BaseModel, Field


class DailyUpdateAuthor(BaseModel):
    id: int
    first_name: str
    last_name: str
    profile_picture: str | None = None

    model_config = {"from_attributes": True}


class DailyUpdateTaskBrief(BaseModel):
    id: int
    title: str

    model_config = {"from_attributes": True}


class DailyUpdateUpsert(BaseModel):
    update_date: date
    content: str = Field(..., max_length=20000)
    task_ids: list[int] = []
    mentioned_user_ids: list[int] = []


class MentionedLine(BaseModel):
    id: int
    line_text: str
    update_date: date
    author: DailyUpdateAuthor
    tasks: list[DailyUpdateTaskBrief] = []
    read_only: bool = True


class DailyUpdateResponse(BaseModel):
    id: int
    user_id: int
    update_date: date
    content: str
    editable: bool
    editable_until: datetime
    author: DailyUpdateAuthor
    tasks: list[DailyUpdateTaskBrief] = []
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class DailyUpdateDayResponse(BaseModel):
    date: date
    editable: bool
    editable_until: datetime | None
    own_update: DailyUpdateResponse | None = None
    mentioned_lines: list[MentionedLine] = []
    team_updates: list[DailyUpdateResponse] = []
    filtered_user: DailyUpdateAuthor | None = None


class CalendarDayMarker(BaseModel):
    date: date
    has_own: bool = False
    mention_count: int = 0
    team_count: int = 0


class CalendarResponse(BaseModel):
    year: int
    month: int
    days: list[CalendarDayMarker]
