from datetime import datetime

from pydantic import BaseModel, Field


class ClientBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    notes: str | None = None


class ClientCreate(ClientBase):
    pass


class ClientUpdate(BaseModel):
    name: str | None = None
    notes: str | None = None
    is_archived: bool | None = None


class ClientResponse(ClientBase):
    id: int
    is_archived: bool
    created_at: datetime
    task_count: int = 0

    model_config = {"from_attributes": True}
