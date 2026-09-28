"""Daily Telegram digests for opted-in managers."""

from __future__ import annotations

import logging

from sqlalchemy.orm import Session

from app.core.constants import UserRole
from app.models import TelegramAccount, User
from app.services.telegram_client import TelegramClient
from app.services.telegram_formatter import format_team_snapshot
from app.services.telegram_task_service import TelegramTaskService

logger = logging.getLogger(__name__)


class TelegramDigestService:
    def __init__(self, db: Session):
        self.db = db
        self.tasks = TelegramTaskService(db)
        self.client = TelegramClient()

    def run(self) -> dict:
        if not self.client.enabled:
            return {"sent": 0, "skipped": 0, "errors": 0, "message": "Telegram bot token not configured"}

        recipients = (
            self.db.query(User, TelegramAccount)
            .join(TelegramAccount, TelegramAccount.user_id == User.id)
            .filter(
                User.status == "active",
                User.role.in_([UserRole.ADMIN.value, UserRole.MANAGER.value]),
                User.telegram_daily_digest_enabled == True,  # noqa: E712
                TelegramAccount.is_active == True,  # noqa: E712
            )
            .all()
        )

        snapshot = self.tasks.team_today_snapshot()
        body = format_team_snapshot(snapshot)
        header = "Daily Work OS digest\n\n"
        text = header + body

        sent = skipped = errors = 0
        for user, account in recipients:
            if not user.telegram_notifications_enabled:
                skipped += 1
                continue
            ok = self.client.send_message(account.chat_id, text)
            if ok:
                sent += 1
            else:
                errors += 1
                logger.error("Failed digest to user_id=%s chat_id=%s", user.id, account.chat_id)

        return {"sent": sent, "skipped": skipped, "errors": errors, "recipients": len(recipients)}
