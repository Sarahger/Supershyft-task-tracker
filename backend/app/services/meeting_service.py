from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import HTTPException
from sqlalchemy.orm import Session, joinedload

from app.core.config import settings
from app.core.constants import MeetingAttendanceStatus, MeetingLogType, NotificationType
from app.models import MeetingDaySetting, MeetingLog, Task, User
from app.repositories.base import TaskRepository, user_to_brief_dict
from app.services.notification_service import NotificationService

MORNING_START = time(9, 45)
MORNING_END = time(10, 5)
MORNING_ON_TIME_CUTOFF = time(10, 0)

# Fallback offsets when tzdata is not installed (common on Windows dev machines)
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


def _local_date(dt: datetime) -> date:
    return dt.astimezone(_tz()).date()


def _day_bounds(target: date) -> tuple[datetime, datetime]:
    tz = _tz()
    start = datetime.combine(target, time.min, tzinfo=tz)
    end = datetime.combine(target, time.max, tzinfo=tz)
    return start, end


def _in_morning_window(local_dt: datetime) -> bool:
    t = local_dt.timetz().replace(tzinfo=None)
    return MORNING_START <= t <= MORNING_END


def _morning_status(local_dt: datetime) -> str:
    t = local_dt.timetz().replace(tzinfo=None)
    if t <= MORNING_ON_TIME_CUTOFF:
        return MeetingAttendanceStatus.ON_TIME.value
    return MeetingAttendanceStatus.LATE.value


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
        "user": user_to_brief_dict(log.user) if log.user else None,
    }


class MeetingService:
    def __init__(self, db: Session):
        self.db = db

    def is_morning_call_enabled(self, target: date) -> bool:
        row = self.db.query(MeetingDaySetting).filter(MeetingDaySetting.meeting_date == target).first()
        return row.morning_call_enabled if row else True

    def set_morning_call_enabled(self, target: date, enabled: bool, user: User) -> dict:
        row = self.db.query(MeetingDaySetting).filter(MeetingDaySetting.meeting_date == target).first()
        if row:
            row.morning_call_enabled = enabled
            row.updated_by_id = user.id
            row.updated_at = datetime.now(timezone.utc)
        else:
            row = MeetingDaySetting(
                meeting_date=target,
                morning_call_enabled=enabled,
                updated_by_id=user.id,
            )
            self.db.add(row)
        self.db.commit()
        self.db.refresh(row)
        return {"meeting_date": row.meeting_date, "morning_call_enabled": row.morning_call_enabled}

    def _get_morning_log_for_day(self, user_id: int, target: date) -> MeetingLog | None:
        start, end = _day_bounds(target)
        return (
            self.db.query(MeetingLog)
            .filter(
                MeetingLog.user_id == user_id,
                MeetingLog.log_type == MeetingLogType.MORNING_ATTENDANCE.value,
                MeetingLog.click_time >= start,
                MeetingLog.click_time <= end,
            )
            .order_by(MeetingLog.click_time.asc())
            .first()
        )

    def join_meeting(self, user: User, kind: str, task_id: int | None = None) -> dict:
        now_utc = datetime.now(timezone.utc)
        now_local = _now_local()
        today = now_local.date()
        meet_url = settings.GOOGLE_MEET_URL

        if kind == "morning":
            if not self.is_morning_call_enabled(today):
                raise HTTPException(status_code=400, detail="Morning call is disabled for today")
            if _in_morning_window(now_local):
                existing = self._get_morning_log_for_day(user.id, today)
                log_type = MeetingLogType.MORNING_ATTENDANCE.value
                status = _morning_status(now_local)
                if existing:
                    if now_utc < existing.click_time:
                        existing.click_time = now_utc
                        existing.status = status
                        self.db.commit()
                        self.db.refresh(existing)
                        log = existing
                    else:
                        log = existing
                else:
                    log = MeetingLog(
                        user_id=user.id,
                        click_time=now_utc,
                        log_type=log_type,
                        status=status,
                    )
                    self.db.add(log)
                    self.db.commit()
                    self.db.refresh(log)
            else:
                log = MeetingLog(
                    user_id=user.id,
                    click_time=now_utc,
                    log_type=MeetingLogType.GENERAL.value,
                    status=None,
                )
                self.db.add(log)
                self.db.commit()
                self.db.refresh(log)
        elif kind == "quick":
            log = MeetingLog(
                user_id=user.id,
                click_time=now_utc,
                log_type=MeetingLogType.GENERAL.value,
                status=None,
            )
            self.db.add(log)
            self.db.commit()
            self.db.refresh(log)
        elif kind == "task":
            if not task_id:
                raise HTTPException(status_code=400, detail="task_id is required for task calls")
            task = TaskRepository(self.db).get_by_id(task_id)
            if not task:
                raise HTTPException(status_code=404, detail="Task not found")
            log = MeetingLog(
                user_id=user.id,
                task_id=task_id,
                click_time=now_utc,
                log_type=MeetingLogType.TASK_DISCUSSION.value,
                status=None,
            )
            self.db.add(log)
            self.db.commit()
            self.db.refresh(log)
            self._notify_task_call(task, user, meet_url)
        else:
            raise HTTPException(status_code=400, detail="Invalid meeting kind")

        log = (
            self.db.query(MeetingLog)
            .options(joinedload(MeetingLog.user), joinedload(MeetingLog.task))
            .filter(MeetingLog.id == log.id)
            .first()
        )
        return {"redirect_url": meet_url, "log": _log_to_dict(log)}

    def _notify_task_call(self, task: Task, starter: User, meet_url: str) -> None:
        notifications = NotificationService(self.db)
        title = f"Quick call started: {task.title}"
        message = f"{starter.full_name} has started a quick call for task: {task.title}. Click to join."
        assignee_ids = {a.user_id for a in task.assignees}
        for user_id in assignee_ids:
            if user_id == starter.id:
                continue
            notifications.notify(
                user_id,
                NotificationType.TASK_CALL.value,
                title,
                message,
                meet_url,
                send_email=False,
            )

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
        log = (
            self.db.query(MeetingLog)
            .options(joinedload(MeetingLog.user), joinedload(MeetingLog.task))
            .filter(MeetingLog.id == log.id)
            .first()
        )
        return _log_to_dict(log)

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
        late_arrivals = []
        if include_manager_data:
            late_arrivals = [
                _log_to_dict(l)
                for l in logs
                if l.log_type == MeetingLogType.MORNING_ATTENDANCE.value
                and l.status == MeetingAttendanceStatus.LATE.value
            ]
        task_calls = [
            _log_to_dict(l)
            for l in logs
            if l.log_type == MeetingLogType.TASK_DISCUSSION.value
        ]
        return {
            "date": target,
            "morning_call_enabled": self.is_morning_call_enabled(target),
            "meet_url": settings.GOOGLE_MEET_URL,
            "my_logs": my_logs,
            "late_arrivals": late_arrivals,
            "task_calls": task_calls,
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
