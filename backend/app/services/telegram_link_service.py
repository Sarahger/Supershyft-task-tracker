"""Account linking between Telegram identities and Work OS users."""

from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.core.security import get_password_hash, verify_password
from app.models import TelegramAccount, TelegramLinkCode, User, utcnow

LINK_CODE_TTL_MINUTES = 10
LINK_CODE_LENGTH = 8


class TelegramLinkService:
    def __init__(self, db: Session):
        self.db = db

    def create_link_code(self, user: User) -> tuple[str, datetime]:
        raw = secrets.token_hex(LINK_CODE_LENGTH // 2).upper()
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=LINK_CODE_TTL_MINUTES)
        row = TelegramLinkCode(
            user_id=user.id,
            code_hash=get_password_hash(raw),
            expires_at=expires_at,
        )
        self.db.add(row)
        self.db.commit()
        return raw, expires_at

    def get_account_by_telegram_user_id(self, telegram_user_id: str | int) -> TelegramAccount | None:
        return (
            self.db.query(TelegramAccount)
            .filter(
                TelegramAccount.telegram_user_id == str(telegram_user_id),
                TelegramAccount.is_active == True,  # noqa: E712
            )
            .first()
        )

    def get_account_for_user(self, user_id: int) -> TelegramAccount | None:
        return (
            self.db.query(TelegramAccount)
            .filter(TelegramAccount.user_id == user_id, TelegramAccount.is_active == True)  # noqa: E712
            .first()
        )

    def unlink_user(self, user: User) -> bool:
        account = self.db.query(TelegramAccount).filter(TelegramAccount.user_id == user.id).first()
        if not account:
            return False
        self.db.delete(account)
        self.db.commit()
        return True

    def link_with_code(
        self,
        *,
        code: str,
        telegram_user_id: str | int,
        chat_id: str | int,
        telegram_username: str | None = None,
    ) -> tuple[User | None, str]:
        """Return (user, error_message). On success error_message is empty."""
        now = datetime.now(timezone.utc)
        candidates = (
            self.db.query(TelegramLinkCode)
            .filter(TelegramLinkCode.used_at.is_(None), TelegramLinkCode.expires_at > now)
            .order_by(TelegramLinkCode.created_at.desc())
            .limit(50)
            .all()
        )
        matched: TelegramLinkCode | None = None
        for row in candidates:
            if verify_password(code.strip().upper(), row.code_hash) or verify_password(code.strip(), row.code_hash):
                matched = row
                break
        if not matched:
            return None, "Invalid or expired link code. Generate a new one in Work OS Settings."

        user = self.db.query(User).filter(User.id == matched.user_id).first()
        if not user or user.status == "inactive":
            return None, "Work OS account is inactive."

        tg_uid = str(telegram_user_id)
        chat = str(chat_id)

        # One Telegram identity → one Work OS user
        existing_tg = (
            self.db.query(TelegramAccount).filter(TelegramAccount.telegram_user_id == tg_uid).first()
        )
        if existing_tg and existing_tg.user_id != user.id:
            return None, "This Telegram account is already linked to another Work OS user. Unlink first."

        existing_user = self.db.query(TelegramAccount).filter(TelegramAccount.user_id == user.id).first()
        if existing_user:
            existing_user.telegram_user_id = tg_uid
            existing_user.chat_id = chat
            existing_user.telegram_username = telegram_username
            existing_user.is_active = True
            existing_user.updated_at = utcnow()
        else:
            self.db.add(
                TelegramAccount(
                    user_id=user.id,
                    telegram_user_id=tg_uid,
                    chat_id=chat,
                    telegram_username=telegram_username,
                    is_active=True,
                )
            )

        matched.used_at = now
        self.db.commit()
        self.db.refresh(user)
        return user, ""

    def resolve_linked_user(self, telegram_user_id: str | int) -> User | None:
        account = self.get_account_by_telegram_user_id(telegram_user_id)
        if not account:
            return None
        user = self.db.query(User).filter(User.id == account.user_id).first()
        if not user or user.status == "inactive":
            return None
        return user
