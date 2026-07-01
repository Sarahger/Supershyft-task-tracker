import math

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

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
        open_count = (
            db.query(Task)
            .join(TaskAssignee)
            .filter(TaskAssignee.user_id == user.id, Task.status.notin_(["completed", "cancelled"]), Task.is_archived == False)
            .count()
        )
        completed_count = (
            db.query(Task)
            .join(TaskAssignee)
            .filter(TaskAssignee.user_id == user.id, Task.status == "completed")
            .count()
        )
        pending_reviews = db.query(Task).filter(Task.reviewer_id == user.id, Task.status == "in_review").count()
        result.update({
            "open_tasks_count": open_count,
            "completed_tasks_count": completed_count,
            "pending_reviews_count": pending_reviews,
        })
    return result
