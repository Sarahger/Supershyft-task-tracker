from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class UserBase(BaseModel):
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    role: str = "employee"
    status: str = "active"
    job_title: str | None = None
    phone: str | None = None
    manager_id: int | None = None


class UserCreate(UserBase):
    password: str = Field(..., min_length=6)
    department_ids: list[int] = []


class UserUpdate(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    email: EmailStr | None = None
    role: str | None = None
    status: str | None = None
    job_title: str | None = None
    phone: str | None = None
    manager_id: int | None = None
    department_ids: list[int] | None = None
    password: str | None = None


class DepartmentBrief(BaseModel):
    id: int
    name: str

    model_config = {"from_attributes": True}


class UserBrief(BaseModel):
    id: int
    first_name: str
    last_name: str
    email: str
    role: str
    profile_picture: str | None = None
    job_title: str | None = None

    model_config = {"from_attributes": True}

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}"


class UserResponse(UserBase):
    id: int
    profile_picture: str | None = None
    last_login: datetime | None = None
    created_at: datetime
    departments: list[DepartmentBrief] = []

    model_config = {"from_attributes": True}


class UserProfileResponse(UserResponse):
    open_tasks_count: int = 0
    completed_tasks_count: int = 0
    pending_reviews_count: int = 0
