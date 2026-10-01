"""OpenRouter client for optional task summaries."""

from __future__ import annotations

import logging
from typing import Any

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"


class OpenRouterService:
    def __init__(self):
        self.api_key = (settings.OPENROUTER_API_KEY or "").strip()
        self.model = (settings.OPENROUTER_MODEL or "openrouter/free").strip()
        self.timeout = float(settings.OPENROUTER_TIMEOUT_SECONDS or 10.0)

    @property
    def enabled(self) -> bool:
        return bool(self.api_key)

    def summarize_tasks(self, *, title: str, tasks: list[dict[str, Any]]) -> str | None:
        if not self.enabled:
            return None
        if not tasks:
            return "No tasks to summarize."

        system = (
            "You summarize work-task lists for a manager chat. "
            "Be concise (max 8 short sentences). Do not invent tasks. "
            "Do not mention emails, passwords, or secrets. Use plain text only."
        )
        # Compact payload — no emails / tokens / long descriptions
        lines = [
            f"- {t.get('title')} [{t.get('status')}] time={t.get('estimated_hours')} due={t.get('due_date')}"
            for t in tasks
        ]
        user_content = f"{title}\n\nTasks:\n" + "\n".join(lines)

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": settings.FRONTEND_URL or "https://localhost",
            "X-Title": "Supershyft Task Tracker Telegram Bot",
        }
        body = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user_content},
            ],
            "temperature": 0.3,
            "max_tokens": 400,
        }
        try:
            with httpx.Client(timeout=self.timeout) as client:
                resp = client.post(OPENROUTER_URL, headers=headers, json=body)
                if resp.status_code == 429:
                    logger.warning("OpenRouter rate limited")
                    return None
                if resp.status_code >= 400:
                    logger.error("OpenRouter error %s: %s", resp.status_code, resp.text[:300])
                    return None
                data = resp.json()
                content = data["choices"][0]["message"]["content"]
                return (content or "").strip() or None
        except Exception:
            logger.exception("OpenRouter request failed")
            return None
