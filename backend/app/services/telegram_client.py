"""Thin Telegram Bot API client using httpx."""

from __future__ import annotations

import logging

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

TELEGRAM_API = "https://api.telegram.org"


class TelegramClient:
    def __init__(self, token: str | None = None):
        self.token = (token if token is not None else settings.TELEGRAM_BOT_TOKEN).strip()

    @property
    def enabled(self) -> bool:
        return bool(self.token)

    def _url(self, method: str) -> str:
        return f"{TELEGRAM_API}/bot{self.token}/{method}"

    def send_message(self, chat_id: str | int, text: str, *, parse_mode: str | None = None) -> bool:
        if not self.enabled:
            logger.warning("Telegram bot token not configured; skip send_message")
            return False
        payload: dict = {
            "chat_id": chat_id,
            "text": text[:4000],
            "disable_web_page_preview": True,
        }
        if parse_mode:
            payload["parse_mode"] = parse_mode
        try:
            with httpx.Client(timeout=15.0) as client:
                resp = client.post(self._url("sendMessage"), json=payload)
                if resp.status_code >= 400:
                    logger.error("Telegram sendMessage failed: %s %s", resp.status_code, resp.text[:300])
                    return False
                return True
        except Exception:
            logger.exception("Telegram sendMessage error")
            return False
