"""Periodic maintenance: archive completed tasks, purge old deleted tasks."""

from __future__ import annotations

import asyncio
import logging
import threading
import time
from datetime import datetime, timedelta, timezone

from sqlalchemy import and_, or_
from sqlalchemy.orm import Session, joinedload

from app.core.config import settings
from app.core.constants import TaskStatus
from app.models import Attachment, Task
from app.services.storage import delete_stored_file

logger = logging.getLogger(__name__)

COMPLETED_RETENTION_DAYS = 7
DELETED_RETENTION_DAYS = 30
_CLEANUP_MIN_INTERVAL_SEC = 60 * 60  # at most once per hour per process
_last_cleanup_at = 0.0
_cleanup_lock = threading.Lock()


def _retention_days(setting_name: str, default: int) -> int:
    return int(getattr(settings, setting_name, default) or default)


def archive_stale_completed_tasks(db: Session, older_than_days: int | None = None) -> int:
    """Soft-delete completed tasks older than N days (same as manual delete / archive)."""
    days = older_than_days if older_than_days is not None else _retention_days(
        "COMPLETED_RETENTION_DAYS", COMPLETED_RETENTION_DAYS
    )
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    now = datetime.now(timezone.utc)
    reason = f"Auto-archived: completed more than {days} days ago"

    candidates = (
        db.query(Task)
        .filter(
            Task.is_archived == False,  # noqa: E712
            Task.status == TaskStatus.COMPLETED.value,
            or_(
                Task.completed_at <= cutoff,
                and_(Task.completed_at.is_(None), Task.updated_at <= cutoff),
            ),
        )
        .all()
    )

    if not candidates:
        return 0

    for task in candidates:
        task.is_archived = True
        task.deletion_reason = reason
        task.deleted_at = now
        task.deleted_by_id = None

    db.commit()
    logger.info("Auto-archived %s completed task(s) older than %s days", len(candidates), days)
    return len(candidates)


def _delete_attachment_files(attachments: list[Attachment]) -> None:
    async def _run() -> None:
        for att in attachments:
            try:
                await delete_stored_file(att.file_path, att.url)
            except Exception:
                logger.warning(
                    "Failed to delete stored file for attachment %s",
                    getattr(att, "id", "?"),
                    exc_info=True,
                )

    if not attachments:
        return
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = None

    if loop and loop.is_running():
        # Shouldn't happen in sync cron/request paths; best-effort schedule
        asyncio.ensure_future(_run())
    else:
        asyncio.run(_run())


def purge_stale_deleted_tasks(db: Session, older_than_days: int | None = None) -> int:
    """Permanently delete soft-deleted tasks older than N days."""
    days = older_than_days if older_than_days is not None else _retention_days(
        "DELETED_RETENTION_DAYS", DELETED_RETENTION_DAYS
    )
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)

    candidates = (
        db.query(Task)
        .options(joinedload(Task.attachments))
        .filter(
            Task.is_archived == True,  # noqa: E712
            or_(
                Task.deleted_at <= cutoff,
                and_(Task.deleted_at.is_(None), Task.updated_at <= cutoff),
            ),
        )
        .all()
    )

    if not candidates:
        return 0

    for task in candidates:
        _delete_attachment_files(list(task.attachments or []))
        db.delete(task)

    db.commit()
    logger.info("Permanently deleted %s archived task(s) older than %s days", len(candidates), days)
    return len(candidates)


def run_task_retention_cleanup(db: Session) -> dict[str, int]:
    archived = archive_stale_completed_tasks(db)
    purged = purge_stale_deleted_tasks(db)
    return {"archived_count": archived, "purged_count": purged}


def maybe_archive_stale_completed_tasks(db: Session, force: bool = False) -> int:
    """Back-compat name: runs full retention cleanup (archive + purge), throttled."""
    result = maybe_run_task_retention_cleanup(db, force=force)
    return result.get("archived_count", 0)


def maybe_run_task_retention_cleanup(db: Session, force: bool = False) -> dict[str, int]:
    """Throttled wrapper so list/health endpoints can safely trigger cleanup."""
    global _last_cleanup_at
    now = time.monotonic()
    with _cleanup_lock:
        if not force and (now - _last_cleanup_at) < _CLEANUP_MIN_INTERVAL_SEC:
            return {"archived_count": 0, "purged_count": 0}
        _last_cleanup_at = now

    try:
        return run_task_retention_cleanup(db)
    except Exception:
        logger.exception("Task retention cleanup failed")
        db.rollback()
        return {"archived_count": 0, "purged_count": 0}
