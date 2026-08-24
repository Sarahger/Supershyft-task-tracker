from datetime import datetime

from pydantic import BaseModel, Field


class OfficeCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    radius_meters: float = Field(150, gt=0, le=50_000)
    max_gps_accuracy_meters: float = Field(100, gt=0, le=10_000)
    is_active: bool = True


class OfficeUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=200)
    latitude: float | None = Field(None, ge=-90, le=90)
    longitude: float | None = Field(None, ge=-180, le=180)
    radius_meters: float | None = Field(None, gt=0, le=50_000)
    max_gps_accuracy_meters: float | None = Field(None, gt=0, le=10_000)
    is_active: bool | None = None


class OfficeResponse(BaseModel):
    id: int
    name: str
    latitude: float
    longitude: float
    radius_meters: float
    max_gps_accuracy_meters: float
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
