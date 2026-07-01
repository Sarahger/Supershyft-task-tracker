from datetime import datetime

from pydantic import BaseModel, Field


class ProjectBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    description: str | None = None
    status: str = "active"
    health: str = "healthy"
    start_date: datetime | None = None
    end_date: datetime | None = None


class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    status: str | None = None
    health: str | None = None
    start_date: datetime | None = None
    end_date: datetime | None = None
    is_archived: bool | None = None


class ProjectResponse(ProjectBase):
    id: int
    is_archived: bool
    created_at: datetime
    open_tasks_count: int = 0
    completed_tasks_count: int = 0
    overdue_tasks_count: int = 0
    progress: float = 0.0

    model_config = {"from_attributes": True}
