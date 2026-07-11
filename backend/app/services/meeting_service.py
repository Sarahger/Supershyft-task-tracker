from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import HTTPException
from sqlalchemy.orm import Session, joinedload

from app.core.config import settings
from app.core.constants import MeetingAttendanceStatus, MeetingLogType, MeetingPoolType, NotificationType
from app.models import GoogleMeetPool, MeetingLog, Task, User
from app.repositories.base import TaskRepository, user_to_brief_dict
from app.services.meet_pool_service import (
    acquire_pool_link,
    get_active_instant_pool_for_user,
    get_active_task_pool,
    release_pool_link,
    release_stale_pool_links,
)
from app.services.notification_service import NotificationService
from app.utils.email import send_plain_urgent_email_sync

MORNING_START = time(9, 45)
MORNING_END = time(11, 15)

_TZ_FALLBACKS: dict[str, timedelta] = {
    "Asia/Kolkata": timedelta(hours=5, minutes=30),
}


def _tz() -> ZoneInfo | timezone:
    try:
        return ZoneInfo(settings.MEETING_TIMEZONE)
    except ZoneInfoNotFoundError:
        offset = _TZ_FALLBACKS.get(settings.MEETING_TIMEZONE, timedelta(hours=5, minutes=30))
        return timezone(offset)


def _now_local() -> datetime:
    return datetime.now(timezone.utc).astimezone(_tz())


def _day_bounds(target: date) -> tuple[datetime, datetime]:
    tz = _tz()
    start = datetime.combine(target, time.min, tzinfo=tz)
    end = datetime.combine(target, time.max, tzinfo=tz)
    return start, end


def _in_morning_window(local_dt: datetime) -> bool:
    t = local_dt.timetz().replace(tzinfo=None)
    return MORNING_START <= t <= MORNING_END


def _task_join_status(occupied_at: datetime, join_time: datetime) -> str:
    buffer = timedelta(minutes=settings.TASK_CALL_BUFFER_MINUTES)
    if join_time <= occupied_at + buffer:
        return MeetingAttendanceStatus.ON_TIME.value
    return MeetingAttendanceStatus.DELAYED_RESPONSE.value


def _log_to_dict(log: MeetingLog) -> dict:
    return {
        "id": log.id,
        "user_id": log.user_id,
        "task_id": log.task_id,
        "task_title": log.task.title if log.task else None,
        "click_time": log.click_time,
        "left_at": log.left_at,
        "log_type": log.log_type,
        "status": log.status,
        "meet_url": log.meet_url,
        "pool_id": log.pool_id,
        "user": user_to_brief_dict(log.user) if log.user else None,
    }


def _pool_to_dict(pool: GoogleMeetPool) -> dict:
    return {
        "id": pool.id,
        "meet_url": pool.meet_url,
        "is_occupied": pool.is_occupied,
        "current_context_id": pool.current_context_id,
        "meeting_type": pool.meeting_type,
        "last_occupied_at": pool.last_occupied_at,
    }


class MeetingService:
    def __init__(self, db: Session):
        self.db = db
        release_stale_pool_links(db)

    def can_join_morning_call(self, target: date | None = None) -> bool:
        now_local = _now_local()
        today = target or now_local.date()
        if today != now_local.date():
            return False
        return _in_morning_window(now_local)

    def _get_open_morning_log_for_day(self, user_id: int, target: date) -> MeetingLog | None:
        start, end = _day_bounds(target)
        return (
            self.db.query(MeetingLog)
            .filter(
                MeetingLog.user_id == user_id,
                MeetingLog.log_type == MeetingLogType.MORNING_ATTENDANCE.value,
                MeetingLog.click_time >= start,
                MeetingLog.click_time <= end,
                MeetingLog.left_at.is_(None),
            )
            .order_by(MeetingLog.click_time.desc())
            .first()
        )

    def _load_log(self, log_id: int) -> MeetingLog:
        log = (
            self.db.query(MeetingLog)
            .options(joinedload(MeetingLog.user), joinedload(MeetingLog.task))
            .filter(MeetingLog.id == log_id)
            .first()
        )
        if not log:
            raise HTTPException(status_code=404, detail="Meeting log not found")
        return log

    def _ensure_task_assignee(self, user: User, task: Task) -> None:
        if not any(a.user_id == user.id for a in task.assignees):
            raise HTTPException(status_code=403, detail="Only task assignees can manage task meetings")

    def join_morning_call(self, user: User) -> dict:
        now_utc = datetime.now(timezone.utc)
        now_local = _now_local()

        if not _in_morning_window(now_local):
            raise HTTPException(
                status_code=400,
                detail="Morning call is only available between 9:45 AM and 11:15 AM",
            )

        today = now_local.date()
        open_log = self._get_open_morning_log_for_day(user.id, today)
        if open_log:
            log = open_log
        else:
            log = MeetingLog(
                user_id=user.id,
                click_time=now_utc,
                log_type=MeetingLogType.MORNING_ATTENDANCE.value,
                status=None,
                meet_url=settings.GOOGLE_MEET_URL,
            )
            self.db.add(log)
            self.db.commit()
            self.db.refresh(log)

        return {"redirect_url": settings.GOOGLE_MEET_URL, "log": _log_to_dict(self._load_log(log.id))}

    def start_instant_general_call(self, user: User, invite_user_ids: list[int]) -> dict:
        pool = acquire_pool_link(self.db, MeetingPoolType.INSTANT.value, user.id)
        now_utc = datetime.now(timezone.utc)

        log = MeetingLog(
            user_id=user.id,
            pool_id=pool.id,
            click_time=now_utc,
            log_type=MeetingLogType.GENERAL.value,
            meet_url=pool.meet_url,
        )
        self.db.add(log)
        self.db.commit()
        self.db.refresh(log)

        self._notify_instant_invites(user, pool.meet_url, invite_user_ids)

        return {
            "redirect_url": pool.meet_url,
            "log": _log_to_dict(self._load_log(log.id)),
            "pool": _pool_to_dict(pool),
        }

    def end_instant_call(self, user: User, pool_id: int) -> dict:
        pool = self.db.query(GoogleMeetPool).filter(GoogleMeetPool.id == pool_id).first()
        if not pool:
            raise HTTPException(status_code=404, detail="Meet pool link not found")
        if pool.meeting_type != MeetingPoolType.INSTANT.value or pool.current_context_id != str(user.id):
            raise HTTPException(status_code=403, detail="Only the call initiator can end this meeting")

        release_pool_link(self.db, pool_id)
        return {"pool": _pool_to_dict(pool)}

    def start_task_call(self, user: User, task_id: int) -> dict:
        task = TaskRepository(self.db).get_by_id(task_id)
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")
        self._ensure_task_assignee(user, task)

        existing = get_active_task_pool(self.db, task_id)
        if existing:
            raise HTTPException(status_code=409, detail="An active task call is already running for this task")

        pool = acquire_pool_link(self.db, MeetingPoolType.TASK.value, task_id)
        now_utc = datetime.now(timezone.utc)

        log = MeetingLog(
            user_id=user.id,
            task_id=task_id,
            pool_id=pool.id,
            click_time=now_utc,
            log_type=MeetingLogType.TASK_DISCUSSION.value,
            meet_url=pool.meet_url,
        )
        self.db.add(log)
        self.db.commit()
        self.db.refresh(log)

        self._notify_task_call_urgent(task, user, pool.meet_url)

        return {
            "redirect_url": pool.meet_url,
            "log": _log_to_dict(self._load_log(log.id)),
            "pool": _pool_to_dict(pool),
        }

    def join_task_call(self, user: User, task_id: int) -> dict:
        task = TaskRepository(self.db).get_by_id(task_id)
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")
        self._ensure_task_assignee(user, task)

        pool = get_active_task_pool(self.db, task_id)
        if not pool or not pool.last_occupied_at:
            raise HTTPException(status_code=404, detail="No active task call found for this task")

        now_utc = datetime.now(timezone.utc)
        status = _task_join_status(pool.last_occupied_at, now_utc)

        existing = (
            self.db.query(MeetingLog)
            .filter(MeetingLog.user_id == user.id, MeetingLog.pool_id == pool.id)
            .first()
        )
        if existing:
            log = existing
        else:
            log = MeetingLog(
                user_id=user.id,
                task_id=task_id,
                pool_id=pool.id,
                click_time=now_utc,
                log_type=MeetingLogType.TASK_DISCUSSION.value,
                status=status,
                meet_url=pool.meet_url,
            )
            self.db.add(log)
            self.db.commit()
            self.db.refresh(log)

        return {
            "redirect_url": pool.meet_url,
            "log": _log_to_dict(self._load_log(log.id)),
            "pool": _pool_to_dict(pool),
        }

    def end_task_call(self, user: User, task_id: int) -> dict:
        task = TaskRepository(self.db).get_by_id(task_id)
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")
        self._ensure_task_assignee(user, task)

        pool = get_active_task_pool(self.db, task_id)
        if not pool:
            raise HTTPException(status_code=404, detail="No active task call found for this task")

        starter_log = (
            self.db.query(MeetingLog)
            .filter(MeetingLog.pool_id == pool.id)
            .order_by(MeetingLog.click_time.asc())
            .first()
        )
        if not starter_log or starter_log.user_id != user.id:
            raise HTTPException(status_code=403, detail="Only the call initiator can end this meeting")

        release_pool_link(self.db, pool.id)
        return {"pool": _pool_to_dict(pool)}

    def get_active_task_call(self, task_id: int) -> dict | None:
        pool = get_active_task_pool(self.db, task_id)
        return _pool_to_dict(pool) if pool else None

    def get_active_instant_call(self, user_id: int) -> dict | None:
        pool = get_active_instant_pool_for_user(self.db, user_id)
        return _pool_to_dict(pool) if pool else None

    def _notify_instant_invites(self, starter: User, meet_url: str, invite_user_ids: list[int]) -> None:
        notifications = NotificationService(self.db)
        subject = "🚨 Urgent Invitation to Instant Meeting"
        body = f"{starter.full_name} is inviting you to an instant sync. Join here: {meet_url}"
        unique_ids = {uid for uid in invite_user_ids if uid != starter.id}
        for user_id in unique_ids:
            invitee = self.db.query(User).filter(User.id == user_id, User.status == "active").first()
            if not invitee:
                continue
            notifications.notify(
                user_id,
                NotificationType.TASK_CALL.value,
                subject,
                body,
                meet_url,
                send_email=False,
            )
            if invitee.email:
                send_plain_urgent_email_sync(invitee.email, subject, body)

    def _notify_task_call_urgent(self, task: Task, starter: User, meet_url: str) -> None:
        notifications = NotificationService(self.db)
        subject = f"🚨 Task Sync Started: {task.title}"
        body = (
            f"{starter.full_name} has started an impromptu meeting for this task. "
            f"Join here immediately: {meet_url}"
        )
        for assignee in task.assignees:
            if assignee.user_id == starter.id:
                continue
            invitee = assignee.user
            if not invitee:
                continue
            notifications.notify(
                assignee.user_id,
                NotificationType.TASK_CALL.value,
                subject,
                body,
                meet_url,
                send_email=False,
            )
            if invitee.email:
                send_plain_urgent_email_sync(invitee.email, subject, body)

    def record_leave(self, user: User, log_id: int | None = None) -> dict:
        now_utc = datetime.now(timezone.utc)
        if log_id:
            log = (
                self.db.query(MeetingLog)
                .filter(MeetingLog.id == log_id, MeetingLog.user_id == user.id)
                .first()
            )
        else:
            today = _now_local().date()
            start, end = _day_bounds(today)
            log = (
                self.db.query(MeetingLog)
                .filter(
                    MeetingLog.user_id == user.id,
                    MeetingLog.click_time >= start,
                    MeetingLog.click_time <= end,
                    MeetingLog.left_at.is_(None),
                )
                .order_by(MeetingLog.click_time.desc())
                .first()
            )
        if not log:
            raise HTTPException(status_code=404, detail="No active meeting log found")
        log.left_at = now_utc
        self.db.commit()
        return _log_to_dict(self._load_log(log.id))

    def get_day_summary(self, user: User, target: date, include_manager_data: bool) -> dict:
        start, end = _day_bounds(target)
        logs = (
            self.db.query(MeetingLog)
            .options(joinedload(MeetingLog.user), joinedload(MeetingLog.task))
            .filter(MeetingLog.click_time >= start, MeetingLog.click_time <= end)
            .order_by(MeetingLog.click_time.asc())
            .all()
        )
        my_logs = [_log_to_dict(l) for l in logs if l.user_id == user.id]
        morning_attendance = []
        if include_manager_data:
            morning_attendance = [
                _log_to_dict(l)
                for l in logs
                if l.log_type == MeetingLogType.MORNING_ATTENDANCE.value
            ]
        task_calls = [
            _log_to_dict(l)
            for l in logs
            if l.log_type == MeetingLogType.TASK_DISCUSSION.value
        ]
        general_calls = [
            _log_to_dict(l)
            for l in logs
            if l.log_type == MeetingLogType.GENERAL.value
        ]
        active_instant = self.get_active_instant_call(user.id) if target == _now_local().date() else None

        return {
            "date": target,
            "morning_call_join_available": self.can_join_morning_call(target),
            "morning_meet_url": settings.GOOGLE_MEET_URL,
            "my_logs": my_logs,
            "morning_attendance": morning_attendance,
            "task_calls": task_calls,
            "general_calls": general_calls,
            "active_instant_call": active_instant,
            "pool_available_count": self.db.query(GoogleMeetPool).filter(GoogleMeetPool.is_occupied.is_(False)).count(),
        }

    def get_task_logs(self, task_id: int) -> list[dict]:
        logs = (
            self.db.query(MeetingLog)
            .options(joinedload(MeetingLog.user), joinedload(MeetingLog.task))
            .filter(MeetingLog.task_id == task_id)
            .order_by(MeetingLog.click_time.desc())
            .limit(20)
            .all()
        )
        return [_log_to_dict(l) for l in logs]
