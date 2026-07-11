import logging
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.constants import MeetingPoolType
from app.models import GoogleMeetPool

logger = logging.getLogger(__name__)

DEFAULT_POOL_URLS = [
    "https://meet.google.com/ige-iyay-ijx",
    "https://meet.google.com/dpv-yupp-ewa",
    "https://meet.google.com/ymb-zrso-fae",
    "https://meet.google.com/bvh-xuss-uyi",
    "https://meet.google.com/fwe-azwe-vrr",
    "https://meet.google.com/iwc-pwup-qjq",
    "https://meet.google.com/fvc-zwpw-uwn",
    "https://meet.google.com/avi-awsm-onz",
]

POOL_EXHAUSTED_MSG = "All meeting links are currently occupied. Please try again in a few minutes."


def seed_meet_pool(db: Session) -> None:
    existing = {row.meet_url for row in db.query(GoogleMeetPool.meet_url).all()}
    added = 0
    for url in DEFAULT_POOL_URLS:
        if url not in existing:
            db.add(GoogleMeetPool(meet_url=url))
            added += 1
    if added:
        db.commit()
        logger.info("Seeded %s Google Meet pool link(s)", added)


def release_stale_pool_links(db: Session) -> int:
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=settings.MEET_POOL_AUTO_RELEASE_MINUTES)
    stale = (
        db.query(GoogleMeetPool)
        .filter(
            GoogleMeetPool.is_occupied.is_(True),
            GoogleMeetPool.last_occupied_at.isnot(None),
            GoogleMeetPool.last_occupied_at < cutoff,
        )
        .all()
    )
    for link in stale:
        link.is_occupied = False
        link.current_context_id = None
        link.meeting_type = None
    if stale:
        db.commit()
        logger.info("Auto-released %s stale Meet pool link(s)", len(stale))
    return len(stale)


def acquire_pool_link(db: Session, meeting_type: str, context_id: str | int) -> GoogleMeetPool:
    release_stale_pool_links(db)
    link = (
        db.query(GoogleMeetPool)
        .filter(GoogleMeetPool.is_occupied.is_(False))
        .order_by(GoogleMeetPool.id.asc())
        .with_for_update()
        .first()
    )
    if not link:
        raise HTTPException(status_code=409, detail=POOL_EXHAUSTED_MSG)

    now = datetime.now(timezone.utc)
    link.is_occupied = True
    link.current_context_id = str(context_id)
    link.meeting_type = meeting_type
    link.last_occupied_at = now
    db.commit()
    db.refresh(link)
    return link


def release_pool_link(db: Session, pool_id: int) -> GoogleMeetPool:
    link = db.query(GoogleMeetPool).filter(GoogleMeetPool.id == pool_id).first()
    if not link:
        raise HTTPException(status_code=404, detail="Meet pool link not found")
    link.is_occupied = False
    link.current_context_id = None
    link.meeting_type = None
    db.commit()
    db.refresh(link)
    return link


def get_active_task_pool(db: Session, task_id: int) -> GoogleMeetPool | None:
    release_stale_pool_links(db)
    return (
        db.query(GoogleMeetPool)
        .filter(
            GoogleMeetPool.is_occupied.is_(True),
            GoogleMeetPool.meeting_type == MeetingPoolType.TASK.value,
            GoogleMeetPool.current_context_id == str(task_id),
        )
        .first()
    )


def get_active_instant_pool_for_user(db: Session, user_id: int) -> GoogleMeetPool | None:
    release_stale_pool_links(db)
    return (
        db.query(GoogleMeetPool)
        .filter(
            GoogleMeetPool.is_occupied.is_(True),
            GoogleMeetPool.meeting_type == MeetingPoolType.INSTANT.value,
            GoogleMeetPool.current_context_id == str(user_id),
        )
        .first()
    )
