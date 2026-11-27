from pydantic import BaseModel, Field


class WorkVaultFolderCreate(BaseModel):
    name: str | None = Field(None, max_length=300)
    description: str | None = Field(None, max_length=20000)
    unique: bool = False


class WorkVaultFolderUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=300)
    description: str | None = Field(None, max_length=20000)


class WorkVaultResourceUpdate(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=300)
    description: str | None = Field(None, max_length=20000)
    category: str | None = Field(None, min_length=1, max_length=100)
    tags: list[str] | str | None = None
    url: str | None = Field(None, max_length=2000)
    http_method: str | None = Field(None, max_length=10)
