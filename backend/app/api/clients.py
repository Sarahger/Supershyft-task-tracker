import math

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.database import get_db
from app.models import Client, Task, User
from app.schemas.common import APIResponse, PaginatedData
from app.schemas.client import ClientCreate, ClientUpdate

router = APIRouter(prefix="/clients", tags=["clients"])


@router.get("")
def list_clients(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    clients = db.query(Client).filter(Client.is_archived == False).all()
    return APIResponse(data=[_format_client(c, db) for c in clients])


@router.post("")
def create_client(data: ClientCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    client = Client(**data.model_dump())
    db.add(client)
    db.commit()
    db.refresh(client)
    return APIResponse(data=_format_client(client, db), message="Client created")


@router.put("/{client_id}")
def update_client(client_id: int, data: ClientUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(client, key, value)
    db.commit()
    db.refresh(client)
    return APIResponse(data=_format_client(client, db), message="Client updated")


def _format_client(client: Client, db: Session) -> dict:
    task_count = db.query(Task).filter(Task.client_id == client.id).count()
    return {
        "id": client.id,
        "name": client.name,
        "notes": client.notes,
        "is_archived": client.is_archived,
        "created_at": client.created_at,
        "task_count": task_count,
    }
