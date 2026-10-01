"""Thin Telegram Bot API client using httpx."""

from __future__ import annotations

import logging

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

TELEGRAM_API = "https://api.telegram.org"
MAX_CHUNK = 3900


class TelegramClient:
    def __init__(self, token: str | None = None):
        self.token = (token if token is not None else settings.TELEGRAM_BOT_TOKEN).strip()

    @property
    def enabled(self) -> bool:
        return bool(self.token)

    def _url(self, method: str) -> str:
        return f"{TELEGRAM_API}/bot{self.token}/{method}"

    def _chunks(self, text: str) -> list[str]:
        text = (text or "").rstrip()
        if len(text) <= MAX_CHUNK:
            return [text] if text else []
        parts: list[str] = []
        remaining = text
        while remaining:
            if len(remaining) <= MAX_CHUNK:
                parts.append(remaining)
                break
            cut = remaining.rfind("\n", 0, MAX_CHUNK)
            if cut < MAX_CHUNK // 2:
                cut = MAX_CHUNK
            parts.append(remaining[:cut].rstrip())
            remaining = remaining[cut:].lstrip("\n")
        return parts

    def send_message(self, chat_id: str | int, text: str, *, parse_mode: str | None = None) -> bool:
        if not self.enabled:
            logger.warning("Telegram bot token not configured; skip send_message")
            return False
        ok = True
        for chunk in self._chunks(text):
            payload: dict = {
                "chat_id": chat_id,
                "text": chunk,
                "disable_web_page_preview": True,
            }
            if parse_mode:
                payload["parse_mode"] = parse_mode
            try:
                with httpx.Client(timeout=15.0) as client:
                    resp = client.post(self._url("sendMessage"), json=payload)
                    if resp.status_code >= 400:
                        logger.error("Telegram sendMessage failed: %s %s", resp.status_code, resp.text[:300])
                        ok = False
            except Exception:
                logger.exception("Telegram sendMessage error")
                ok = False
        return ok
