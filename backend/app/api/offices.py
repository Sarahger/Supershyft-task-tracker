from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, require_admin
from app.db.database import get_db
from app.models import Office, User
from app.schemas.common import APIResponse
from app.schemas.office import OfficeCreate, OfficeResponse, OfficeUpdate

router = APIRouter(prefix="/offices", tags=["offices"])


def _format_office(office: Office) -> dict:
    return OfficeResponse.model_validate(office).model_dump()


@router.get("")
def list_offices(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    offices = db.query(Office).order_by(Office.name.asc()).all()
    return APIResponse(data=[_format_office(o) for o in offices])


@router.post("", dependencies=[Depends(require_admin)])
def create_office(data: OfficeCreate, db: Session = Depends(get_db)):
    office = Office(
        name=data.name.strip(),
        latitude=data.latitude,
        longitude=data.longitude,
        radius_meters=data.radius_meters,
        max_gps_accuracy_meters=data.max_gps_accuracy_meters,
        is_active=data.is_active,
    )
    db.add(office)
    db.commit()
    db.refresh(office)
    return APIResponse(data=_format_office(office), message="Office created")


@router.put("/{office_id}", dependencies=[Depends(require_admin)])
def update_office(office_id: int, data: OfficeUpdate, db: Session = Depends(get_db)):
    office = db.query(Office).filter(Office.id == office_id).first()
    if not office:
        raise HTTPException(status_code=404, detail="Office not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        if key == "name" and isinstance(value, str):
            value = value.strip()
        setattr(office, key, value)
    office.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(office)
    return APIResponse(data=_format_office(office), message="Office updated")
