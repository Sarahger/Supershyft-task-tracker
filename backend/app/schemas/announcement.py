from datetime import date, datetime

from pydantic import BaseModel, Field


class AnnouncementLinkCreate(BaseModel):
    url: str = Field(..., min_length=4, max_length=2000)
    title: str | None = Field(None, max_length=300)


class AnnouncementCreate(BaseModel):
    body: str = Field(..., min_length=1, max_length=20000)
    mentioned_user_ids: list[int] = []
    links: list[AnnouncementLinkCreate] = []
