from pydantic import BaseModel, Field


class CustomFieldCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    field_key: str | None = None
    field_type: str = "text"
    applies_to: str = "task"
    options: list[str] = []
    sort_order: int = 0


class CustomFieldUpdate(BaseModel):
    name: str | None = None
    field_type: str | None = None
    options: list[str] | None = None
    sort_order: int | None = None
    is_active: bool | None = None


class TaskCustomFieldValuesUpdate(BaseModel):
    values: dict[str, str | None]
