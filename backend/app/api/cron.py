import hmac
import os

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.database import get_db
from app.schemas.common import APIResponse
from app.services.task_cleanup import (
    COMPLETED_RETENTION_DAYS,
    DELETED_RETENTION_DAYS,
    run_task_retention_cleanup,
)

router = APIRouter(prefix="/cron", tags=["cron"])


def _verify_cron(authorization: str | None) -> None:
    secret = (settings.CRON_SECRET or os.getenv("CRON_SECRET", "")).strip()
    if not secret:
        # Local / unset: allow. Set CRON_SECRET on Vercel for production.
        return
    expected = f"Bearer {secret}"
    if not authorization or not hmac.compare_digest(authorization, expected):
        raise HTTPException(status_code=401, detail="Unauthorized")


@router.post("/archive-completed-tasks")
@router.get("/archive-completed-tasks")
def cron_task_retention(
    db: Session = Depends(get_db),
    authorization: str | None = Header(default=None),
):
    """Daily job: archive completed (>7d) and permanently delete archived (>30d)."""
    _verify_cron(authorization)
    result = run_task_retention_cleanup(db)
    return APIResponse(
        data={
            **result,
            "completed_retention_days": COMPLETED_RETENTION_DAYS,
            "deleted_retention_days": DELETED_RETENTION_DAYS,
        },
        message=(
            f"Archived {result['archived_count']} completed task(s); "
            f"permanently deleted {result['purged_count']} old deleted task(s)"
        ),
    )
