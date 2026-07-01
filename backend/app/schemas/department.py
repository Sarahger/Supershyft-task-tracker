from datetime import datetime

from pydantic import BaseModel, Field


class DepartmentBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: str | None = None
    manager_id: int | None = None


class DepartmentCreate(DepartmentBase):
    pass


class DepartmentUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    manager_id: int | None = None


class DepartmentResponse(DepartmentBase):
    id: int
    created_at: datetime
    member_count: int = 0
    open_tasks_count: int = 0

    model_config = {"from_attributes": True}
