import math
import os
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session, joinedload

from app.core.config import settings
from app.core.dependencies import get_current_user
from app.db.database import get_db
from app.models import (
    Attachment,
    Checklist,
    ChecklistItem,
    Comment,
    SavedFilter,
    Tag,
    Task,
    TaskType,
    User,
)
from app.repositories.base import ActivityRepository, SearchRepository, TaskRepository, user_to_dict
from app.schemas.common import APIResponse, PaginatedData
from app.schemas.misc import CommentCreate, CommentUpdate, SavedFilterCreate, SearchResponse
from app.schemas.task import (
    BlockTaskRequest,
    ChecklistCreate,
    ChecklistItemCreate,
    ChecklistItemUpdate,
    ReviewActionRequest,
    TaskAssigneeComplete,
    TaskCreate,
    TaskStatusUpdate,
    TaskUpdate,
    TaskTypeCreate,
    TagCreate,
)
from app.services.task_service import TaskService

router = APIRouter(tags=["tasks"])


@router.get("/tasks")
def list_tasks(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500),
    status: str | None = None,
    priority: str | None = None,
    project_id: int | None = None,
    assignee_id: int | None = None,
    reviewer_id: int | None = None,
    department_id: int | None = None,
    search: str | None = None,
    overdue: bool | None = None,
    blocked: bool | None = None,
    awaiting_review: bool | None = None,
    has_due_date: bool | None = None,
    due_after: datetime | None = None,
    due_before: datetime | None = None,
    sort_by: str = "updated_at",
    sort_order: str = "desc",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    repo = TaskRepository(db)
    service = TaskService(db)
    filters = {
        k: v
        for k, v in {
            "status": status,
            "priority": priority,
            "project_id": project_id,
            "assignee_id": assignee_id,
            "reviewer_id": reviewer_id,
            "department_id": department_id,
            "search": search,
            "overdue": overdue,
            "blocked": blocked,
            "awaiting_review": awaiting_review,
            "has_due_date": has_due_date,
            "due_after": due_after,
            "due_before": due_before,
            "sort_by": sort_by,
            "sort_order": sort_order,
        }.items()
        if v is not None
    }
    skip = (page - 1) * page_size
    tasks, total = repo.get_filtered(skip=skip, limit=page_size, filters=filters)
    return APIResponse(
        data=PaginatedData(
            items=[service.task_to_list_dict(t) for t in tasks],
            total=total,
            page=page,
            page_size=page_size,
            total_pages=math.ceil(total / page_size) if total else 0,
        )
    )


@router.get("/tasks/my")
def my_tasks(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    repo = TaskRepository(db)
    service = TaskService(db)
    tasks, _ = repo.get_filtered(filters={"assignee_id": current_user.id}, limit=200)
    return APIResponse(data=[service.task_to_list_dict(t) for t in tasks])


@router.get("/tasks/{task_id}")
def get_task(task_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    task = TaskRepository(db).get_by_id(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return APIResponse(data=TaskService(db).task_to_detail_dict(task))


@router.post("/tasks")
def create_task(data: TaskCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    task = TaskService(db).create_task(data.model_dump(), current_user)
    return APIResponse(data=TaskService(db).task_to_detail_dict(task), message="Task created")


@router.put("/tasks/{task_id}")
def update_task(
    task_id: int,
    data: TaskUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = TaskRepository(db).get_by_id(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    task = TaskService(db).update_task(task, data.model_dump(exclude_unset=True), current_user)
    return APIResponse(data=TaskService(db).task_to_detail_dict(task), message="Task updated")


@router.patch("/tasks/{task_id}/status")
def update_status(
    task_id: int,
    data: TaskStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = TaskRepository(db).get_by_id(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    task = TaskService(db).change_status(
        task, data.status, current_user, block_reason=data.block_reason, bug_notes=data.bug_notes
    )
    return APIResponse(data=TaskService(db).task_to_detail_dict(task))


@router.post("/tasks/{task_id}/block")
def block_task(
    task_id: int,
    data: BlockTaskRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = TaskRepository(db).get_by_id(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    task = TaskService(db).change_status(task, "blocked", current_user, block_reason=data.block_reason)
    return APIResponse(data=TaskService(db).task_to_detail_dict(task))


@router.post("/tasks/{task_id}/unblock")
def unblock_task(task_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    task = TaskRepository(db).get_by_id(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    task = TaskService(db).change_status(task, "unblock", current_user)
    return APIResponse(data=TaskService(db).task_to_detail_dict(task))


@router.patch("/tasks/{task_id}/assignees/{user_id}/complete")
def mark_complete(
    task_id: int,
    user_id: int,
    data: TaskAssigneeComplete,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = TaskRepository(db).get_by_id(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    try:
        task = TaskService(db).mark_assignee_complete(task, user_id, data.is_completed)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return APIResponse(data=TaskService(db).task_to_detail_dict(task))


@router.post("/tasks/{task_id}/review")
def review_task(
    task_id: int,
    data: ReviewActionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = TaskRepository(db).get_by_id(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    try:
        task = TaskService(db).review_task(task, current_user, data.action, data.review_comments)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return APIResponse(data=TaskService(db).task_to_detail_dict(task))


@router.post("/tasks/{task_id}/reopen")
def reopen_task(task_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    task = TaskRepository(db).get_by_id(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    task = TaskService(db).reopen_task(task, current_user)
    return APIResponse(data=TaskService(db).task_to_detail_dict(task))


@router.post("/tasks/{task_id}/dependencies/{depends_on_id}")
def add_dependency(
    task_id: int,
    depends_on_id: int,
    depends_on_user_id: int | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = TaskRepository(db).get_by_id(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    try:
        dep = TaskService(db).add_dependency(task, depends_on_id, depends_on_user_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    depends_on = TaskRepository(db).get_by_id(depends_on_id)
    depends_on_user = db.query(User).filter(User.id == depends_on_user_id).first() if depends_on_user_id else None
    return APIResponse(
        data={
            "id": dep.id,
            "depends_on_id": dep.depends_on_id,
            "depends_on_title": depends_on.title if depends_on else None,
            "depends_on_user_id": dep.depends_on_user_id,
            "depends_on_user": user_to_dict(depends_on_user) if depends_on_user else None,
        },
        message="Dependency added",
    )


@router.delete("/tasks/{task_id}/dependencies/{dependency_id}")
def remove_dependency(
    task_id: int,
    dependency_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = TaskRepository(db).get_by_id(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    try:
        TaskService(db).remove_dependency(task, dependency_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return APIResponse(message="Dependency removed")


@router.get("/tasks/{task_id}/comments")
def get_comments(task_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    comments = db.query(Comment).filter(Comment.task_id == task_id, Comment.parent_id == None).all()
    return APIResponse(data=[_format_comment(c) for c in comments])


@router.post("/tasks/{task_id}/comments")
def add_comment(
    task_id: int,
    data: CommentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    comment = Comment(task_id=task_id, author_id=current_user.id, content=data.content, parent_id=data.parent_id)
    db.add(comment)
    db.commit()
    db.refresh(comment)
    ActivityRepository(db).log(current_user.id, "comment_added", f"Added comment", task_id)
    return APIResponse(data=_format_comment(comment))


@router.put("/comments/{comment_id}")
def edit_comment(
    comment_id: int,
    data: CommentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    comment = db.query(Comment).filter(Comment.id == comment_id).first()
    if not comment or comment.author_id != current_user.id:
        raise HTTPException(status_code=404, detail="Comment not found")
    comment.content = data.content
    comment.is_edited = True
    db.commit()
    return APIResponse(data=_format_comment(comment))


@router.get("/tasks/{task_id}/activity")
def get_activity(task_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    logs = ActivityRepository(db).get_for_task(task_id)
    return APIResponse(
        data=[
            {
                "id": l.id,
                "activity_type": l.activity_type,
                "description": l.description,
                "created_at": l.created_at,
                "user": user_to_dict(l.user),
            }
            for l in logs
        ]
    )


@router.post("/tasks/{task_id}/checklists")
def add_checklist(
    task_id: int,
    data: ChecklistCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    checklist = Checklist(task_id=task_id, title=data.title)
    for i, item in enumerate(data.items):
        checklist.items.append(ChecklistItem(title=item.title, sort_order=item.sort_order or i))
    db.add(checklist)
    db.commit()
    db.refresh(checklist)
    return APIResponse(data={"id": checklist.id, "title": checklist.title})


@router.post("/tasks/{task_id}/checklist-items")
def add_checklist_item(
    task_id: int,
    data: ChecklistItemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    if not data.title.strip():
        raise HTTPException(status_code=400, detail="Title is required")

    checklist = db.query(Checklist).filter(Checklist.task_id == task_id).order_by(Checklist.id).first()
    if not checklist:
        checklist = Checklist(task_id=task_id, title="Checklist")
        db.add(checklist)
        db.flush()

    sort_order = data.sort_order if data.sort_order else len(checklist.items)
    item = ChecklistItem(checklist_id=checklist.id, title=data.title.strip(), sort_order=sort_order)
    db.add(item)
    db.commit()
    db.refresh(item)
    return APIResponse(
        data={
            "id": item.id,
            "title": item.title,
            "is_completed": item.is_completed,
            "sort_order": item.sort_order,
        },
        message="Checklist item added",
    )


@router.patch("/checklist-items/{item_id}")
def update_checklist_item(
    item_id: int,
    data: ChecklistItemUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    item = db.query(ChecklistItem).filter(ChecklistItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(item, key, value)
    db.commit()
    return APIResponse(data={"id": item.id, "is_completed": item.is_completed})


@router.post("/tasks/{task_id}/attachments")
async def upload_attachment(
    task_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    ext = os.path.splitext(file.filename or "file")[1]
    filename = f"{uuid.uuid4()}{ext}"
    filepath = os.path.join(settings.UPLOAD_DIR, filename)
    content = await file.read()
    if len(content) > settings.MAX_UPLOAD_SIZE:
        raise HTTPException(status_code=400, detail="File too large")
    with open(filepath, "wb") as f:
        f.write(content)
    attachment = Attachment(
        task_id=task_id,
        uploaded_by_id=current_user.id,
        attachment_type="file",
        filename=file.filename,
        file_path=filepath,
        file_size=len(content),
        mime_type=file.content_type,
    )
    db.add(attachment)
    db.commit()
    db.refresh(attachment)
    ActivityRepository(db).log(current_user.id, "attachment_uploaded", f"Uploaded {attachment.filename}", task_id)
    return APIResponse(
        data={
            "id": attachment.id,
            "filename": attachment.filename,
            "file_size": attachment.file_size,
            "mime_type": attachment.mime_type,
            "attachment_type": attachment.attachment_type,
            "created_at": attachment.created_at,
            "uploaded_by": user_to_dict(current_user),
        },
    )


def _format_attachment(attachment: Attachment) -> dict:
    return {
        "id": attachment.id,
        "filename": attachment.filename,
        "file_size": attachment.file_size,
        "mime_type": attachment.mime_type,
        "attachment_type": attachment.attachment_type,
        "created_at": attachment.created_at,
        "uploaded_by": user_to_dict(attachment.uploader),
    }


@router.get("/tasks/{task_id}/attachments")
def list_attachments(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = TaskRepository(db).get_by_id(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    attachments = (
        db.query(Attachment)
        .options(joinedload(Attachment.uploader))
        .filter(Attachment.task_id == task_id)
        .order_by(Attachment.created_at.desc())
        .all()
    )
    return APIResponse(data=[_format_attachment(a) for a in attachments])


@router.get("/attachments/{attachment_id}/download")
def download_attachment(
    attachment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    attachment = db.query(Attachment).filter(Attachment.id == attachment_id).first()
    if not attachment or not attachment.file_path:
        raise HTTPException(status_code=404, detail="Attachment not found")
    if not os.path.exists(attachment.file_path):
        raise HTTPException(status_code=404, detail="File not found on disk")
    return FileResponse(
        attachment.file_path,
        filename=attachment.filename or os.path.basename(attachment.file_path),
        media_type=attachment.mime_type or "application/octet-stream",
    )


@router.get("/task-types")
def list_task_types(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    types = db.query(TaskType).filter(TaskType.is_active == True).all()
    return APIResponse(data=[{"id": t.id, "name": t.name, "color": t.color} for t in types])


@router.post("/task-types")
def create_task_type(data: TaskTypeCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    tt = TaskType(**data.model_dump())
    db.add(tt)
    db.commit()
    return APIResponse(data={"id": tt.id, "name": tt.name})


@router.get("/tags")
def list_tags(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    tags = db.query(Tag).all()
    return APIResponse(data=[{"id": t.id, "name": t.name, "color": t.color} for t in tags])


@router.post("/tags")
def create_tag(data: TagCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    tag = Tag(**data.model_dump())
    db.add(tag)
    db.commit()
    return APIResponse(data={"id": tag.id, "name": tag.name})


@router.get("/search")
def global_search(q: str = Query(..., min_length=1), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    results = SearchRepository(db).search(q)
    return APIResponse(
        data={
            "tasks": [{"id": t.id, "type": "task", "title": t.title, "subtitle": t.status, "link": f"/tasks/{t.id}"} for t in results["tasks"]],
            "projects": [{"id": p.id, "type": "project", "title": p.name, "subtitle": p.status, "link": f"/projects/{p.id}"} for p in results["projects"]],
            "users": [{"id": u.id, "type": "user", "title": u.full_name, "subtitle": u.email, "link": f"/users/{u.id}"} for u in results["users"]],
            "clients": [{"id": c.id, "type": "client", "title": c.name, "link": f"/clients/{c.id}"} for c in results["clients"]],
            "tags": [{"id": t.id, "type": "tag", "title": t.name} for t in results["tags"]],
            "comments": [],
        }
    )


@router.get("/saved-filters")
def list_saved_filters(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    filters = db.query(SavedFilter).filter(SavedFilter.user_id == current_user.id).all()
    return APIResponse(data=[{"id": f.id, "name": f.name, "filter_json": f.filter_json, "is_default": f.is_default} for f in filters])


@router.post("/saved-filters")
def create_saved_filter(
    data: SavedFilterCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    sf = SavedFilter(user_id=current_user.id, **data.model_dump())
    db.add(sf)
    db.commit()
    return APIResponse(data={"id": sf.id, "name": sf.name})


def _format_comment(comment: Comment) -> dict:
    return {
        "id": comment.id,
        "task_id": comment.task_id,
        "author_id": comment.author_id,
        "parent_id": comment.parent_id,
        "content": comment.content,
        "is_edited": comment.is_edited,
        "created_at": comment.created_at,
        "updated_at": comment.updated_at,
        "author": user_to_dict(comment.author) if comment.author else None,
        "replies": [_format_comment(r) for r in comment.replies] if hasattr(comment, "replies") else [],
    }
