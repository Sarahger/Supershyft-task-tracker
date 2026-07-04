import math

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload

from app.core.dependencies import get_current_user, require_admin, require_manager
from app.db.database import get_db
from app.models import User
from app.repositories.base import UserRepository
from app.schemas.common import APIResponse, PaginatedData
from app.schemas.user import UserCreate, UserUpdate
from app.services.auth_service import UserService

router = APIRouter(prefix="/users", tags=["users"])


@router.get("")
def list_users(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    repo = UserRepository(db)
    skip = (page - 1) * page_size
    users, total = repo.get_all(skip=skip, limit=page_size, search=search)
    items = [_format_user(u, db) for u in users]
    return APIResponse(
        data=PaginatedData(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=math.ceil(total / page_size) if total else 0,
        )
    )


@router.get("/{user_id}")
def get_user(user_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    user = UserRepository(db).get_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return APIResponse(data=_format_user(user, db, include_stats=True))


@router.post("", dependencies=[Depends(require_admin)])
def create_user(data: UserCreate, db: Session = Depends(get_db)):
    try:
        user = UserService(db).create_user(data.model_dump())
        return APIResponse(data=_format_user(user, db), message="User created")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/{user_id}")
def update_user(
    user_id: int,
    data: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role == "employee" and current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Cannot update other users")
    user = UserRepository(db).get_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    update_data = data.model_dump(exclude_unset=True)
    if current_user.role == "manager" and current_user.id != user_id:
        update_data = {k: v for k, v in update_data.items() if k == "status"}
        if not update_data:
            raise HTTPException(status_code=403, detail="Managers can only update user status")
    elif current_user.role != "administrator":
        update_data = {k: v for k, v in update_data.items() if k in ("first_name", "last_name", "phone", "job_title", "password")}
    user = UserService(db).update_user(user, update_data)
    return APIResponse(data=_format_user(user, db), message="User updated")


@router.delete("/{user_id}", dependencies=[Depends(require_admin)])
def deactivate_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot deactivate your own account")
    user = UserRepository(db).get_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.status = "inactive"
    db.commit()
    return APIResponse(message="User deactivated")


def _format_user(user: User, db: Session, include_stats: bool = False) -> dict:
    from app.models import Task, TaskAssignee

    result = {
        "id": user.id,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "email": user.email,
        "role": user.role,
        "status": user.status,
        "job_title": user.job_title,
        "phone": user.phone,
        "profile_picture": user.profile_picture,
        "manager_id": user.manager_id,
        "last_login": user.last_login,
        "created_at": user.created_at,
        "departments": [{"id": d.id, "name": d.name} for d in user.departments],
    }
    if include_stats:
        tasks = (
            db.query(Task)
            .join(TaskAssignee)
            .options(joinedload(Task.project))
            .filter(TaskAssignee.user_id == user.id, Task.is_archived == False)
            .order_by(Task.updated_at.desc())
            .all()
        )
        completed_tasks = [t for t in tasks if t.status == "completed"]
        pending_tasks = [t for t in tasks if t.status not in ("completed", "cancelled")]
        cancelled_tasks = [t for t in tasks if t.status == "cancelled"]

        total_estimated = sum(t.estimated_hours for t in tasks if t.estimated_hours is not None)
        total_actual = sum(t.actual_hours for t in tasks if t.actual_hours is not None)

        timed_completed = [
            t for t in completed_tasks
            if t.estimated_hours is not None and t.actual_hours is not None and t.estimated_hours > 0
        ]
        on_track = sum(1 for t in timed_completed if t.actual_hours <= t.estimated_hours)
        over_budget = len(timed_completed) - on_track
        utilization = round((total_actual / total_estimated) * 100, 1) if total_estimated > 0 else None

        pending_reviews = db.query(Task).filter(Task.reviewer_id == user.id, Task.status == "in_review").count()

        result.update({
            "open_tasks_count": len(pending_tasks),
            "completed_tasks_count": len(completed_tasks),
            "pending_reviews_count": pending_reviews,
            "task_stats": {
                "assigned_count": len(tasks),
                "pending_count": len(pending_tasks),
                "completed_count": len(completed_tasks),
                "cancelled_count": len(cancelled_tasks),
                "total_estimated_hours": round(total_estimated, 1),
                "total_actual_hours": round(total_actual, 1),
                "time_utilization_percent": utilization,
                "on_track_count": on_track,
                "over_budget_count": over_budget,
                "tasks_with_time_data": len(timed_completed),
            },
            "assigned_tasks": [
                {
                    "id": t.id,
                    "title": t.title,
                    "status": t.status,
                    "priority": t.priority,
                    "project_name": t.project.name if t.project else None,
                    "due_date": t.due_date,
                    "estimated_hours": t.estimated_hours,
                    "actual_hours": t.actual_hours,
                    "updated_at": t.updated_at,
                }
                for t in tasks
            ],
        })
    return result
