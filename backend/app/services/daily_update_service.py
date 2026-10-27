from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import HTTPException
from sqlalchemy.orm import Session, joinedload

from app.core.config import settings
from app.core.constants import NotificationType
from app.models import DailyUpdate, DailyUpdateMention, Task, User
from app.repositories.base import user_to_brief_dict
from app.services.notification_service import NotificationService
from app.utils.mentions import resolve_mentioned_user_ids

EDIT_CUTOFF = time(10, 30)

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


def editable_until_for(update_date: date) -> datetime:
    tz = _tz()
    return datetime.combine(update_date + timedelta(days=1), EDIT_CUTOFF, tzinfo=tz)


def is_editable(update_date: date, now: datetime | None = None) -> bool:
    now = now or _now_local()
    tz = _tz()
    if now.tzinfo is None:
        now = now.replace(tzinfo=tz)
    else:
        now = now.astimezone(tz)
    start = datetime.combine(update_date, time.min, tzinfo=tz)
    end = editable_until_for(update_date)
    return start <= now < end


def _task_briefs(tasks: list[Task]) -> list[dict]:
    return [{"id": t.id, "title": t.title} for t in tasks]


def _format_update(update: DailyUpdate, editable: bool | None = None) -> dict:
    can_edit = is_editable(update.update_date) if editable is None else editable
    return {
        "id": update.id,
        "user_id": update.user_id,
        "update_date": update.update_date,
        "content": update.content or "",
        "editable": can_edit,
        "editable_until": editable_until_for(update.update_date),
        "author": user_to_brief_dict(update.user),
        "tasks": _task_briefs(list(update.tasks or [])),
        "created_at": update.created_at,
        "updated_at": update.updated_at,
    }


def _extract_mention_lines(
    content: str, db: Session, explicit_ids: list[int] | None = None
) -> list[tuple[int, str]]:
    """Return (mentioned_user_id, line_text) for each line that mentions someone."""
    results: list[tuple[int, str]] = []
    seen: set[tuple[int, str]] = set()
    for raw_line in (content or "").splitlines():
        line = raw_line.strip()
        if not line or "@" not in line:
            continue
        ids = resolve_mentioned_user_ids(line, db, explicit_ids)
        for uid in ids:
            key = (uid, line)
            if key in seen:
                continue
            seen.add(key)
            results.append((uid, line))
    return results


class DailyUpdateService:
    def __init__(self, db: Session):
        self.db = db

    def get_day(self, user: User, day: date, filter_user_id: int | None = None) -> dict:
        editable = is_editable(day)
        until = editable_until_for(day)

        own = (
            self.db.query(DailyUpdate)
            .options(joinedload(DailyUpdate.user), joinedload(DailyUpdate.tasks))
            .filter(DailyUpdate.user_id == user.id, DailyUpdate.update_date == day)
            .first()
        )

        mention_rows = (
            self.db.query(DailyUpdateMention)
            .options(
                joinedload(DailyUpdateMention.daily_update).joinedload(DailyUpdate.user),
                joinedload(DailyUpdateMention.daily_update).joinedload(DailyUpdate.tasks),
            )
            .join(DailyUpdate)
            .filter(
                DailyUpdateMention.mentioned_user_id == user.id,
                DailyUpdate.update_date == day,
                DailyUpdate.user_id != user.id,
            )
            .all()
        )
        mentioned_lines = [
            {
                "id": m.id,
                "line_text": m.line_text,
                "update_date": m.daily_update.update_date,
                "author": user_to_brief_dict(m.daily_update.user),
                "tasks": _task_briefs(list(m.daily_update.tasks or [])),
                "read_only": True,
            }
            for m in mention_rows
        ]

        team_updates: list[dict] = []
        q = (
            self.db.query(DailyUpdate)
            .options(joinedload(DailyUpdate.user), joinedload(DailyUpdate.tasks))
            .filter(DailyUpdate.update_date == day)
        )
        if filter_user_id:
            q = q.filter(DailyUpdate.user_id == filter_user_id)
        else:
            q = q.filter(DailyUpdate.user_id != user.id)
        team_updates = [_format_update(u, editable=False) for u in q.order_by(DailyUpdate.user_id).all()]

        filtered_user = None
        if filter_user_id:
            person = self.db.query(User).filter(User.id == filter_user_id).first()
            if person:
                filtered_user = user_to_brief_dict(person)

        return {
            "date": day,
            "editable": editable,
            "editable_until": until,
            "own_update": _format_update(own) if own else None,
            "mentioned_lines": mentioned_lines,
            "team_updates": team_updates,
            "filtered_user": filtered_user,
        }

    def get_calendar(self, user: User, year: int, month: int) -> dict:
        if month < 1 or month > 12:
            raise HTTPException(status_code=400, detail="Invalid month")
        start = date(year, month, 1)
        if month == 12:
            end = date(year + 1, 1, 1)
        else:
            end = date(year, month + 1, 1)

        own_dates = {
            row[0]
            for row in self.db.query(DailyUpdate.update_date)
            .filter(
                DailyUpdate.user_id == user.id,
                DailyUpdate.update_date >= start,
                DailyUpdate.update_date < end,
            )
            .all()
        }

        mention_counts: dict[date, int] = {}
        mention_rows = (
            self.db.query(DailyUpdate.update_date, DailyUpdateMention.id)
            .join(DailyUpdateMention, DailyUpdateMention.daily_update_id == DailyUpdate.id)
            .filter(
                DailyUpdateMention.mentioned_user_id == user.id,
                DailyUpdate.update_date >= start,
                DailyUpdate.update_date < end,
                DailyUpdate.user_id != user.id,
            )
            .all()
        )
        for d, _ in mention_rows:
            mention_counts[d] = mention_counts.get(d, 0) + 1

        team_counts: dict[date, int] = {}
        team_rows = (
            self.db.query(DailyUpdate.update_date)
            .filter(
                DailyUpdate.update_date >= start,
                DailyUpdate.update_date < end,
                DailyUpdate.user_id != user.id,
            )
            .all()
        )
        for (d,) in team_rows:
            team_counts[d] = team_counts.get(d, 0) + 1

        all_dates = set(own_dates) | set(mention_counts) | set(team_counts)
        days = [
            {
                "date": d,
                "has_own": d in own_dates,
                "mention_count": mention_counts.get(d, 0),
                "team_count": team_counts.get(d, 0),
            }
            for d in sorted(all_dates)
        ]
        return {"year": year, "month": month, "days": days}

    def upsert(
        self,
        user: User,
        update_date: date,
        content: str,
        task_ids: list[int],
        mentioned_user_ids: list[int],
    ) -> dict:
        if not is_editable(update_date):
            raise HTTPException(
                status_code=403,
                detail="This daily update can only be edited from that day until 10:30 AM the next day",
            )

        content = (content or "").strip()
        if not content:
            raise HTTPException(status_code=400, detail="Update content cannot be empty")

        tasks: list[Task] = []
        if task_ids:
            tasks = self.db.query(Task).filter(Task.id.in_(task_ids)).all()
            found = {t.id for t in tasks}
            missing = [tid for tid in task_ids if tid not in found]
            if missing:
                raise HTTPException(status_code=400, detail=f"Unknown task ids: {missing}")

        update = (
            self.db.query(DailyUpdate)
            .options(joinedload(DailyUpdate.mentions), joinedload(DailyUpdate.tasks))
            .filter(DailyUpdate.user_id == user.id, DailyUpdate.update_date == update_date)
            .first()
        )
        if update is None:
            update = DailyUpdate(user_id=user.id, update_date=update_date, content=content)
            self.db.add(update)
            self.db.flush()
        else:
            update.content = content

        update.tasks = tasks

        previous_mentioned = {m.mentioned_user_id for m in (update.mentions or [])}

        for old in list(update.mentions or []):
            self.db.delete(old)
        self.db.flush()

        mention_pairs = _extract_mention_lines(content, self.db, mentioned_user_ids)
        newly_mentioned: set[int] = set()
        for uid, line in mention_pairs:
            if uid == user.id:
                continue
            self.db.add(
                DailyUpdateMention(
                    daily_update_id=update.id,
                    mentioned_user_id=uid,
                    line_text=line,
                )
            )
            if uid not in previous_mentioned:
                newly_mentioned.add(uid)

        self.db.commit()
        update = (
            self.db.query(DailyUpdate)
            .options(joinedload(DailyUpdate.user), joinedload(DailyUpdate.tasks))
            .filter(DailyUpdate.id == update.id)
            .first()
        )

        preview = content.replace("\n", " ")
        if len(preview) > 120:
            preview = preview[:117] + "..."
        for uid in newly_mentioned:
            NotificationService(self.db).notify(
                uid,
                NotificationType.MENTION.value,
                f"Mentioned in {user.full_name}'s daily update",
                f'{user.full_name}: "{preview}"',
                f"/daily-updates?date={update_date.isoformat()}",
            )

        return _format_update(update)
