from datetime import datetime

from pydantic import BaseModel, Field


class CommentCreate(BaseModel):
    content: str = Field(..., min_length=1)
    parent_id: int | None = None


class CommentUpdate(BaseModel):
    content: str = Field(..., min_length=1)


class CommentResponse(BaseModel):
    id: int
    task_id: int
    author_id: int
    parent_id: int | None = None
    content: str
    is_edited: bool
    created_at: datetime
    updated_at: datetime
    author: dict | None = None
    replies: list["CommentResponse"] = []

    model_config = {"from_attributes": True}


class AttachmentCreate(BaseModel):
    url: str | None = None
    link_type: str | None = None
    attachment_type: str = "link"


class AttachmentResponse(BaseModel):
    id: int
    attachment_type: str
    filename: str | None = None
    file_path: str | None = None
    file_size: int | None = None
    mime_type: str | None = None
    url: str | None = None
    link_type: str | None = None
    created_at: datetime
    uploader: dict | None = None

    model_config = {"from_attributes": True}


class ActivityLogResponse(BaseModel):
    id: int
    activity_type: str
    description: str
    created_at: datetime
    user: dict | None = None
    metadata_json: str | None = None

    model_config = {"from_attributes": True}


class TaskVersionResponse(BaseModel):
    id: int
    version_number: int
    submission_notes: str | None = None
    review_result: str
    review_comments: str | None = None
    is_locked: bool
    created_at: datetime
    creator: dict | None = None
    reviewer: dict | None = None

    model_config = {"from_attributes": True}


class NotificationResponse(BaseModel):
    id: int
    notification_type: str
    title: str
    message: str | None = None
    link: str | None = None
    is_read: bool
    email_sent: bool = False
    created_at: datetime

    model_config = {"from_attributes": True}


class NotificationPreferences(BaseModel):
    email_notifications_enabled: bool = True
    notify_task_assigned: bool = True
    notify_task_updates: bool = True
    notify_reviews: bool = True
    notify_comments: bool = True


class NotificationPreferencesUpdate(BaseModel):
    email_notifications_enabled: bool | None = None
    notify_task_assigned: bool | None = None
    notify_task_updates: bool | None = None
    notify_reviews: bool | None = None
    notify_comments: bool | None = None


class SavedFilterCreate(BaseModel):
    name: str
    filter_json: str
    is_default: bool = False


class SavedFilterResponse(BaseModel):
    id: int
    name: str
    filter_json: str
    is_default: bool

    model_config = {"from_attributes": True}


class SearchResultItem(BaseModel):
    id: int
    type: str
    title: str
    subtitle: str | None = None
    link: str | None = None


class SearchResponse(BaseModel):
    tasks: list[SearchResultItem] = []
    projects: list[SearchResultItem] = []
    users: list[SearchResultItem] = []
    clients: list[SearchResultItem] = []
    comments: list[SearchResultItem] = []
    tags: list[SearchResultItem] = []


class DashboardStats(BaseModel):
    open_tasks: int = 0
    completed_tasks: int = 0
    blocked_tasks: int = 0
    overdue_tasks: int = 0
    pending_reviews: int = 0
    my_tasks_today: int = 0
    my_tasks_week: int = 0


class ReportFilter(BaseModel):
    start_date: datetime | None = None
    end_date: datetime | None = None
    department_id: int | None = None
    project_id: int | None = None
    user_id: int | None = None
    client_id: int | None = None
