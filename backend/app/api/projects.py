import math
from app.core.datetime_utils import as_utc, utcnow

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, require_manager
from app.db.database import get_db
from app.models import Project, Task, User
from app.repositories.base import ProjectRepository
from app.schemas.common import APIResponse, PaginatedData
from app.schemas.project import ProjectCreate, ProjectUpdate

router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("")
def list_projects(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    repo = ProjectRepository(db)
    skip = (page - 1) * page_size
    projects, total = repo.get_all(skip=skip, limit=page_size)
    return APIResponse(
        data=PaginatedData(
            items=[_format_project(p, db) for p in projects],
            total=total,
            page=page,
            page_size=page_size,
            total_pages=math.ceil(total / page_size) if total else 0,
        )
    )


@router.get("/{project_id}")
def get_project(project_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    project = ProjectRepository(db).get_by_id(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return APIResponse(data=_format_project(project, db))


@router.post("", dependencies=[Depends(require_manager)])
def create_project(data: ProjectCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    project = Project(**data.model_dump(), created_by_id=current_user.id)
    project = ProjectRepository(db).create(project)
    return APIResponse(data=_format_project(project, db), message="Project created")


@router.put("/{project_id}", dependencies=[Depends(require_manager)])
def update_project(project_id: int, data: ProjectUpdate, db: Session = Depends(get_db)):
    repo = ProjectRepository(db)
    project = repo.get_by_id(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(project, key, value)
    project = repo.update(project)
    return APIResponse(data=_format_project(project, db), message="Project updated")


def _format_project(project: Project, db: Session) -> dict:
    tasks = db.query(Task).filter(Task.project_id == project.id, Task.is_archived == False).all()
    open_tasks = [t for t in tasks if t.status not in ("completed", "cancelled")]
    completed = [t for t in tasks if t.status == "completed"]
    now = utcnow()
    overdue = [t for t in open_tasks if t.due_date and as_utc(t.due_date) < now]
    total = len(tasks)
    progress = (len(completed) / total * 100) if total else 0
    return {
        "id": project.id,
        "name": project.name,
        "description": project.description,
        "status": project.status,
        "health": project.health,
        "start_date": project.start_date,
        "end_date": project.end_date,
        "is_archived": project.is_archived,
        "created_at": project.created_at,
        "open_tasks_count": len(open_tasks),
        "completed_tasks_count": len(completed),
        "overdue_tasks_count": len(overdue),
        "progress": round(progress, 1),
    }
