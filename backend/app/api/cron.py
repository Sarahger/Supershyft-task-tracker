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
    """Daily job: archive completed (>30d) and permanently delete archived (>180d / 6 months)."""
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


@router.post("/telegram-daily-digest")
@router.get("/telegram-daily-digest")
def cron_telegram_daily_digest(
    db: Session = Depends(get_db),
    authorization: str | None = Header(default=None),
):
    """Daily job: send Telegram digests to opted-in managers."""
    _verify_cron(authorization)
    from app.services.telegram_digest_service import TelegramDigestService

    result = TelegramDigestService(db).run()
    return APIResponse(
        data=result,
        message=f"Telegram digests sent={result.get('sent', 0)} errors={result.get('errors', 0)}",
    )


@router.post("/weekly-updates-rollover")
@router.get("/weekly-updates-rollover")
def cron_weekly_updates_rollover(
    db: Session = Depends(get_db),
    authorization: str | None = Header(default=None),
):
    """Monday 2:00 PM IST: lock previous week snapshots and open empty drafts for all employees."""
    _verify_cron(authorization)
    from app.services.weekly_update_service import WeeklyUpdateService

    result = WeeklyUpdateService(db).ensure_all_writable_reports()
    return APIResponse(
        data=result,
        message=(
            f"Weekly updates rollover: created={result.get('created', 0)} "
            f"finalized={result.get('finalized', 0)} "
            f"employees={result.get('employee_count', 0)}"
        ),
    )
