"""Telegram webhook + account linking APIs."""

from __future__ import annotations

import hmac
import logging

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.dependencies import get_current_user
from app.db.database import get_db
from app.models import User
from app.schemas.common import APIResponse
from app.services.telegram_commands import TelegramCommandHandler
from app.services.telegram_link_service import LINK_CODE_TTL_MINUTES, TelegramLinkService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/telegram", tags=["telegram"])


class TelegramPreferencesUpdate(BaseModel):
    telegram_notifications_enabled: bool | None = None
    telegram_daily_digest_enabled: bool | None = None


class LinkCodeResponse(BaseModel):
    code: str
    expires_at: str
    bot_username: str
    instructions: str


class TelegramStatusResponse(BaseModel):
    linked: bool
    telegram_username: str | None = None
    linked_at: str | None = None
    bot_username: str
    telegram_notifications_enabled: bool
    telegram_daily_digest_enabled: bool


def _verify_telegram_secret(header_value: str | None) -> None:
    expected = (settings.TELEGRAM_WEBHOOK_SECRET or "").strip()
    if not expected:
        # Local/dev without secret: allow. Production must set TELEGRAM_WEBHOOK_SECRET.
        if settings.DEBUG:
            return
        raise HTTPException(status_code=503, detail="Telegram webhook secret not configured")
    if not header_value or not hmac.compare_digest(header_value, expected):
        raise HTTPException(status_code=401, detail="Invalid Telegram webhook secret")


@router.post("/webhook")
async def telegram_webhook(
    request: Request,
    db: Session = Depends(get_db),
    x_telegram_bot_api_secret_token: str | None = Header(default=None),
):
    """Receive Telegram updates. Always return 200 quickly when authenticated."""
    _verify_telegram_secret(x_telegram_bot_api_secret_token)

    if not (settings.TELEGRAM_BOT_TOKEN or "").strip():
        logger.warning("Telegram webhook hit but TELEGRAM_BOT_TOKEN is empty")
        return {"ok": True}

    try:
        update = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    try:
        TelegramCommandHandler(db).handle_update(update)
    except Exception:
        logger.exception("Telegram command handling failed")
    return {"ok": True}


@router.post("/link-codes")
def create_link_code(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.status == "inactive":
        raise HTTPException(status_code=403, detail="Inactive users cannot link Telegram")
    code, expires_at = TelegramLinkService(db).create_link_code(current_user)
    bot = settings.TELEGRAM_BOT_USERNAME or "supershyftbot"
    return APIResponse(
        data=LinkCodeResponse(
            code=code,
            expires_at=expires_at.isoformat(),
            bot_username=bot,
            instructions=f"Open Telegram → @{bot} → send: /link {code}",
        ).model_dump(),
        message=f"Link code valid for {LINK_CODE_TTL_MINUTES} minutes",
    )


@router.delete("/link")
def unlink_telegram(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    removed = TelegramLinkService(db).unlink_user(current_user)
    return APIResponse(data={"unlinked": removed}, message="Unlinked" if removed else "Not linked")


@router.get("/status")
def telegram_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    account = TelegramLinkService(db).get_account_for_user(current_user.id)
    bot = settings.TELEGRAM_BOT_USERNAME or "supershyftbot"
    return APIResponse(
        data=TelegramStatusResponse(
            linked=bool(account),
            telegram_username=account.telegram_username if account else None,
            linked_at=account.linked_at.isoformat() if account and account.linked_at else None,
            bot_username=bot,
            telegram_notifications_enabled=bool(current_user.telegram_notifications_enabled),
            telegram_daily_digest_enabled=bool(current_user.telegram_daily_digest_enabled),
        ).model_dump()
    )


@router.patch("/preferences")
def update_telegram_preferences(
    body: TelegramPreferencesUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if body.telegram_notifications_enabled is not None:
        current_user.telegram_notifications_enabled = body.telegram_notifications_enabled
    if body.telegram_daily_digest_enabled is not None:
        current_user.telegram_daily_digest_enabled = body.telegram_daily_digest_enabled
    db.commit()
    db.refresh(current_user)
    return APIResponse(
        data={
            "telegram_notifications_enabled": current_user.telegram_notifications_enabled,
            "telegram_daily_digest_enabled": current_user.telegram_daily_digest_enabled,
        },
        message="Preferences updated",
    )
