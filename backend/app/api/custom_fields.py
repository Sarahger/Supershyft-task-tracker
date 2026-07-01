import json
import re

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, require_admin
from app.db.database import get_db
from app.models import CustomFieldDefinition, TaskCustomFieldValue, User
from app.schemas.common import APIResponse
from app.schemas.custom_field import CustomFieldCreate, CustomFieldUpdate, TaskCustomFieldValuesUpdate

router = APIRouter(prefix="/custom-fields", tags=["custom-fields"])


def _slugify(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")
    return slug[:80] or "field"


def _format_field(field: CustomFieldDefinition) -> dict:
    options = json.loads(field.options) if field.options else []
    return {
        "id": field.id,
        "name": field.name,
        "field_key": field.field_key,
        "field_type": field.field_type,
        "applies_to": field.applies_to,
        "options": options,
        "sort_order": field.sort_order,
        "is_active": field.is_active,
    }


@router.get("")
def list_custom_fields(
    applies_to: str = Query("task"),
    include_inactive: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(CustomFieldDefinition).filter(CustomFieldDefinition.applies_to == applies_to)
    if not include_inactive:
        query = query.filter(CustomFieldDefinition.is_active == True)
    fields = query.order_by(CustomFieldDefinition.sort_order, CustomFieldDefinition.name).all()
    return APIResponse(data=[_format_field(f) for f in fields])


@router.post("", dependencies=[Depends(require_admin)])
def create_custom_field(data: CustomFieldCreate, db: Session = Depends(get_db)):
    field_key = data.field_key or _slugify(data.name)
    if db.query(CustomFieldDefinition).filter(CustomFieldDefinition.field_key == field_key).first():
        raise HTTPException(status_code=400, detail="Field key already exists")
    field = CustomFieldDefinition(
        name=data.name,
        field_key=field_key,
        field_type=data.field_type,
        applies_to=data.applies_to,
        options=json.dumps(data.options) if data.options else None,
        sort_order=data.sort_order,
    )
    db.add(field)
    db.commit()
    db.refresh(field)
    return APIResponse(data=_format_field(field), message="Custom field created")


@router.put("/{field_id}", dependencies=[Depends(require_admin)])
def update_custom_field(field_id: int, data: CustomFieldUpdate, db: Session = Depends(get_db)):
    field = db.query(CustomFieldDefinition).filter(CustomFieldDefinition.id == field_id).first()
    if not field:
        raise HTTPException(status_code=404, detail="Field not found")
    update = data.model_dump(exclude_unset=True)
    if "options" in update and update["options"] is not None:
        update["options"] = json.dumps(update["options"])
    for key, value in update.items():
        setattr(field, key, value)
    db.commit()
    db.refresh(field)
    return APIResponse(data=_format_field(field), message="Custom field updated")


@router.delete("/{field_id}", dependencies=[Depends(require_admin)])
def delete_custom_field(field_id: int, db: Session = Depends(get_db)):
    field = db.query(CustomFieldDefinition).filter(CustomFieldDefinition.id == field_id).first()
    if not field:
        raise HTTPException(status_code=404, detail="Field not found")
    field.is_active = False
    db.commit()
    return APIResponse(message="Custom field removed")


@router.put("/tasks/{task_id}/values")
def update_task_custom_values(
    task_id: int,
    data: TaskCustomFieldValuesUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from app.models import Task

    task = db.query(Task).filter(Task.id == task_id, Task.is_archived == False).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    fields = (
        db.query(CustomFieldDefinition)
        .filter(CustomFieldDefinition.applies_to == "task", CustomFieldDefinition.is_active == True)
        .all()
    )
    field_by_key = {f.field_key: f for f in fields}

    for key, value in data.values.items():
        field = field_by_key.get(key)
        if not field:
            continue
        existing = (
            db.query(TaskCustomFieldValue)
            .filter(TaskCustomFieldValue.task_id == task_id, TaskCustomFieldValue.field_id == field.id)
            .first()
        )
        if value is None or value == "":
            if existing:
                db.delete(existing)
        elif existing:
            existing.value = str(value)
        else:
            db.add(TaskCustomFieldValue(task_id=task_id, field_id=field.id, value=str(value)))

    db.commit()
    return APIResponse(message="Custom fields updated")
