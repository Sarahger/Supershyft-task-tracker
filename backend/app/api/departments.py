from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, require_admin
from app.db.database import get_db
from app.models import Department, Task, User, task_departments
from app.repositories.base import DepartmentRepository
from app.schemas.common import APIResponse
from app.schemas.department import DepartmentCreate, DepartmentUpdate
from app.services.auth_service import UserService

router = APIRouter(prefix="/departments", tags=["departments"])


@router.get("")
def list_departments(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    depts = DepartmentRepository(db).get_all()
    return APIResponse(data=[_format_dept(d, db) for d in depts])


@router.get("/{dept_id}")
def get_department(dept_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    dept = DepartmentRepository(db).get_by_id(dept_id)
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
    return APIResponse(data=_format_dept(dept, db))


@router.post("", dependencies=[Depends(require_admin)])
def create_department(data: DepartmentCreate, db: Session = Depends(get_db)):
    dept = Department(name=data.name, description=data.description, manager_id=data.manager_id)
    dept = DepartmentRepository(db).create(dept)
    return APIResponse(data=_format_dept(dept, db), message="Department created")


@router.put("/{dept_id}", dependencies=[Depends(require_admin)])
def update_department(dept_id: int, data: DepartmentUpdate, db: Session = Depends(get_db)):
    repo = DepartmentRepository(db)
    dept = repo.get_by_id(dept_id)
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(dept, key, value)
    dept = repo.update(dept)
    return APIResponse(data=_format_dept(dept, db), message="Department updated")


def _format_dept(dept: Department, db: Session) -> dict:
    member_count = len(dept.members) if dept.members else 0
    open_tasks = (
        db.query(Task)
        .join(task_departments)
        .filter(task_departments.c.department_id == dept.id, Task.status.notin_(["completed", "cancelled"]))
        .count()
    )
    return {
        "id": dept.id,
        "name": dept.name,
        "description": dept.description,
        "manager_id": dept.manager_id,
        "created_at": dept.created_at,
        "member_count": member_count,
        "open_tasks_count": open_tasks,
    }
