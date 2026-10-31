from pydantic import BaseModel, Field


class WorkVaultResourceUpdate(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=300)
    description: str | None = Field(None, min_length=1, max_length=20000)
    category: str | None = Field(None, min_length=1, max_length=100)
    tags: list[str] | str | None = None
    project_id: int | None = None
    url: str | None = Field(None, max_length=2000)
    http_method: str | None = Field(None, max_length=10)
    clear_project: bool = False
