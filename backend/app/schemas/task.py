from datetime import datetime

from pydantic import BaseModel, Field


class TaskTypeCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    color: str | None = None


class TaskTypeResponse(BaseModel):
    id: int
    name: str
    color: str | None = None
    is_active: bool

    model_config = {"from_attributes": True}


class TagCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    color: str | None = None


class TagResponse(BaseModel):
    id: int
    name: str
    color: str | None = None

    model_config = {"from_attributes": True}


class AssigneeCreate(BaseModel):
    user_id: int


class AssigneeResponse(BaseModel):
    id: int
    user_id: int
    is_completed: bool
    completed_at: datetime | None = None
    user: dict | None = None

    model_config = {"from_attributes": True}


class ChecklistItemCreate(BaseModel):
    title: str
    sort_order: int = 0


class ChecklistItemUpdate(BaseModel):
    title: str | None = None
    is_completed: bool | None = None
    sort_order: int | None = None


class ChecklistItemResponse(BaseModel):
    id: int
    title: str
    is_completed: bool
    sort_order: int

    model_config = {"from_attributes": True}


class ChecklistCreate(BaseModel):
    title: str = "Checklist"
    items: list[ChecklistItemCreate] = []


class ChecklistResponse(BaseModel):
    id: int
    title: str
    items: list[ChecklistItemResponse] = []

    model_config = {"from_attributes": True}


class TaskBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=500)
    description: str | None = None
    task_type_id: int | None = None
    priority: str = "medium"
    severity: str | None = None
    estimated_hours: float | None = None
    actual_hours: float | None = None
    start_date: datetime | None = None
    due_date: datetime | None = None
    project_id: int | None = None
    client_id: int | None = None
    sprint_id: int | None = None
    milestone_id: int | None = None
    reviewer_id: int | None = None
    review_required: bool = False
    testing_required: bool = False


class TaskCreate(TaskBase):
    status: str = "unassigned"
    assignee_ids: list[int] = []
    department_ids: list[int] = []
    tag_ids: list[int] = []


class TaskUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    task_type_id: int | None = None
    priority: str | None = None
    status: str | None = None
    severity: str | None = None
    estimated_hours: float | None = None
    actual_hours: float | None = None
    start_date: datetime | None = None
    due_date: datetime | None = None
    project_id: int | None = None
    client_id: int | None = None
    sprint_id: int | None = None
    milestone_id: int | None = None
    reviewer_id: int | None = None
    review_required: bool | None = None
    testing_required: bool | None = None
    assignee_ids: list[int] | None = None
    department_ids: list[int] | None = None
    tag_ids: list[int] | None = None


class TaskStatusUpdate(BaseModel):
    status: str
    block_reason: str | None = None
    bug_notes: str | None = None


class TaskAssigneeComplete(BaseModel):
    is_completed: bool


class BlockTaskRequest(BaseModel):
    block_reason: str


class DeleteTaskRequest(BaseModel):
    reason: str = Field(..., min_length=1)


class ReviewActionRequest(BaseModel):
    action: str  # approve or request_changes
    review_comments: str | None = None
    submission_notes: str | None = None


class TaskListResponse(BaseModel):
    id: int
    title: str
    status: str
    priority: str
    due_date: datetime | None = None
    project_id: int | None = None
    project_name: str | None = None
    review_required: bool
    testing_required: bool
    assignees: list[dict] = []
    tags: list[dict] = []
    comment_count: int = 0
    attachment_count: int = 0
    checklist_progress: str | None = None
    is_blocked: bool = False
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TaskDetailResponse(TaskBase):
    id: int
    status: str
    previous_status: str | None = None
    block_reason: str | None = None
    blocked_at: datetime | None = None
    bug_notes: str | None = None
    current_version: int
    is_archived: bool
    created_by_id: int
    updated_by_id: int | None = None
    created_at: datetime
    updated_at: datetime
    completed_at: datetime | None = None
    assignees: list[AssigneeResponse] = []
    departments: list[dict] = []
    tags: list[dict] = []
    task_type: dict | None = None
    project: dict | None = None
    client: dict | None = None
    reviewer: dict | None = None
    creator: dict | None = None
    checklists: list[ChecklistResponse] = []
    dependencies: list[dict] = []

    model_config = {"from_attributes": True}
