from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from urllib.parse import urlparse

from fastapi import HTTPException
from sqlalchemy.orm import Session, joinedload

from app.core.constants import NotificationType, UserRole
from app.models import (
    Announcement,
    AnnouncementAttachment,
    AnnouncementMention,
    AnnouncementReaction,
    User,
)
from app.repositories.base import user_to_brief_dict
from app.services.notification_service import NotificationService
from app.utils.mentions import resolve_mentioned_user_ids
from app.utils.week_periods import as_local_date, current_week_start, local_day_bounds, monday_of, today_local


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _as_aware(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


def _valid_http_url(url: str) -> bool:
    parsed = urlparse((url or "").strip())
    return parsed.scheme in ("http", "https") and bool(parsed.netloc)


class AnnouncementService:
    def __init__(self, db: Session):
        self.db = db
        self.notifications = NotificationService(db)

    def list_week(
        self,
        user: User,
        week_start: date | None = None,
        author_id: int | None = None,
        on_date: date | None = None,
    ) -> dict:
        start = monday_of(week_start) if week_start is not None else current_week_start()
        base = (
            self.db.query(Announcement)
            .options(
                joinedload(Announcement.author),
                joinedload(Announcement.mentions).joinedload(AnnouncementMention.mentioned_user),
                joinedload(Announcement.reactions).joinedload(AnnouncementReaction.user),
                joinedload(Announcement.attachments).joinedload(AnnouncementAttachment.uploader),
            )
            .filter(Announcement.week_start == start)
        )
        week_rows = base.order_by(Announcement.created_at.desc()).all()
        authors = sorted(
            {
                row.author_id: user_to_brief_dict(row.author)
                for row in week_rows
                if row.author
            }.values(),
            key=lambda item: (item["first_name"], item["last_name"]),
        )
        rows = week_rows
        if author_id:
            rows = [row for row in rows if row.author_id == author_id]
        if on_date is not None:
            day_start, day_end = local_day_bounds(on_date)
            rows = [
                row
                for row in rows
                if row.created_at is not None and day_start <= _as_aware(row.created_at) < day_end
            ]
        return {
            "week_start": start.isoformat(),
            "week_end": (start + timedelta(days=6)).isoformat(),
            "current_week_start": current_week_start().isoformat(),
            "items": [self._view(row, user) for row in rows],
            "authors": authors,
        }

    def unread_count(self, user: User) -> dict:
        this_week = current_week_start()
        query = self.db.query(Announcement).filter(
            Announcement.week_start == this_week,
            Announcement.author_id != user.id,
        )
        if user.last_seen_announcements_at is not None:
            query = query.filter(Announcement.created_at > user.last_seen_announcements_at)
        return {"count": query.count(), "week_start": this_week.isoformat()}

    def mark_seen(self, user: User) -> dict:
        user.last_seen_announcements_at = _utcnow()
        self.db.commit()
        return {"count": 0, "week_start": current_week_start().isoformat()}

    def create(self, user: User, body: str, mentioned_user_ids: list[int], links: list[dict]) -> dict:
        cleaned = (body or "").strip()
        if not cleaned:
            raise HTTPException(status_code=400, detail="Write something to announce")
        now = _utcnow()
        local_day = as_local_date(now) or today_local()
        row = Announcement(
            author_id=user.id,
            body=cleaned,
            week_start=monday_of(local_day),
            created_at=now,
        )
        self.db.add(row)
        self.db.flush()

        for link in links or []:
            url = (link.get("url") or "").strip()
            if not _valid_http_url(url):
                raise HTTPException(status_code=400, detail="Links must start with http:// or https://")
            title = (link.get("title") or "").strip() or None
            self.db.add(
                AnnouncementAttachment(
                    announcement_id=row.id,
                    uploaded_by_id=user.id,
                    attachment_type="link",
                    filename=title,
                    url=url,
                )
            )

        mentioned_ids = resolve_mentioned_user_ids(cleaned, self.db, mentioned_user_ids)
        mentioned_ids.discard(user.id)
        for mentioned_id in mentioned_ids:
            self.db.add(
                AnnouncementMention(announcement_id=row.id, mentioned_user_id=mentioned_id)
            )
        self.db.commit()
        self.db.refresh(row)

        preview = cleaned if len(cleaned) <= 120 else f"{cleaned[:117]}..."
        for mentioned_id in mentioned_ids:
            self.notifications.notify(
                mentioned_id,
                NotificationType.ANNOUNCEMENT_MENTION.value,
                f"{user.full_name} mentioned you in an announcement",
                preview,
                "/announcements",
            )

        return self._view(self._load(row.id), user)

    def add_link(self, user: User, announcement_id: int, url: str, title: str | None) -> dict:
        row = self._require(announcement_id)
        if row.author_id != user.id:
            raise HTTPException(status_code=403, detail="Only the author can attach a link")
        cleaned_url = (url or "").strip()
        if not _valid_http_url(cleaned_url):
            raise HTTPException(status_code=400, detail="Links must start with http:// or https://")
        attachment = AnnouncementAttachment(
            announcement_id=row.id,
            uploaded_by_id=user.id,
            attachment_type="link",
            filename=(title or "").strip() or None,
            url=cleaned_url,
        )
        self.db.add(attachment)
        self.db.commit()
        return self._view(self._load(row.id), user)

    def add_file(
        self,
        user: User,
        announcement_id: int,
        *,
        filename: str,
        file_path: str,
        public_url: str | None,
        file_size: int,
        mime_type: str | None,
    ) -> dict:
        row = self._require(announcement_id)
        if row.author_id != user.id:
            raise HTTPException(status_code=403, detail="Only the author can attach a file")
        attachment = AnnouncementAttachment(
            announcement_id=row.id,
            uploaded_by_id=user.id,
            attachment_type="file",
            filename=filename,
            file_path=file_path,
            url=public_url,
            file_size=file_size,
            mime_type=mime_type,
        )
        self.db.add(attachment)
        self.db.commit()
        return self._attachment_view(attachment)

    def toggle_reaction(self, user: User, announcement_id: int) -> dict:
        row = self._require(announcement_id)
        existing = (
            self.db.query(AnnouncementReaction)
            .filter(
                AnnouncementReaction.announcement_id == row.id,
                AnnouncementReaction.user_id == user.id,
            )
            .first()
        )
        if existing:
            self.db.delete(existing)
        else:
            self.db.add(AnnouncementReaction(announcement_id=row.id, user_id=user.id))
        self.db.commit()
        return self._view(self._load(row.id), user)

    def delete(self, user: User, announcement_id: int) -> None:
        row = self._require(announcement_id)
        if row.author_id != user.id and user.role != UserRole.ADMIN.value:
            raise HTTPException(status_code=403, detail="You can only delete your own announcement")
        self.db.delete(row)
        self.db.commit()

    def get_attachment(self, attachment_id: int) -> AnnouncementAttachment:
        attachment = (
            self.db.query(AnnouncementAttachment)
            .filter(AnnouncementAttachment.id == attachment_id)
            .first()
        )
        if not attachment:
            raise HTTPException(status_code=404, detail="Attachment not found")
        return attachment

    def _require(self, announcement_id: int) -> Announcement:
        row = self.db.query(Announcement).filter(Announcement.id == announcement_id).first()
        if not row:
            raise HTTPException(status_code=404, detail="Announcement not found")
        return row

    def _load(self, announcement_id: int) -> Announcement:
        row = (
            self.db.query(Announcement)
            .options(
                joinedload(Announcement.author),
                joinedload(Announcement.mentions).joinedload(AnnouncementMention.mentioned_user),
                joinedload(Announcement.reactions).joinedload(AnnouncementReaction.user),
                joinedload(Announcement.attachments).joinedload(AnnouncementAttachment.uploader),
            )
            .filter(Announcement.id == announcement_id)
            .first()
        )
        if not row:
            raise HTTPException(status_code=404, detail="Announcement not found")
        return row

    def _attachment_view(self, attachment: AnnouncementAttachment) -> dict:
        return {
            "id": attachment.id,
            "attachment_type": attachment.attachment_type,
            "filename": attachment.filename,
            "file_size": attachment.file_size,
            "mime_type": attachment.mime_type,
            "url": attachment.url if attachment.attachment_type == "link" else None,
            "created_at": attachment.created_at,
            "uploaded_by": user_to_brief_dict(attachment.uploader),
        }

    def _view(self, row: Announcement, viewer: User) -> dict:
        reacted_ids = [r.user_id for r in (row.reactions or [])]
        return {
            "id": row.id,
            "body": row.body,
            "week_start": row.week_start.isoformat() if row.week_start else None,
            "created_at": row.created_at,
            "author": user_to_brief_dict(row.author),
            "mentions": [
                user_to_brief_dict(m.mentioned_user)
                for m in (row.mentions or [])
                if m.mentioned_user
            ],
            "reaction_count": len(reacted_ids),
            "reacted": viewer.id in reacted_ids,
            "attachments": [self._attachment_view(a) for a in (row.attachments or [])],
            "can_delete": viewer.id == row.author_id or viewer.role == UserRole.ADMIN.value,
        }
