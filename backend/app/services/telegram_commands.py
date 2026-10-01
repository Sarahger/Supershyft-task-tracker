"""Parse and handle Telegram bot commands."""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models import User
from app.services.openrouter_service import OpenRouterService
from app.services.telegram_client import TelegramClient
from app.services.telegram_formatter import format_help, format_task_list, format_team_snapshot
from app.services.telegram_link_service import TelegramLinkService
from app.services.telegram_task_service import TelegramTaskService

logger = logging.getLogger(__name__)

FILTER_ALIASES = {
    "today": "today",
    "wip": "wip",
    "todos": "todos",
    "todo": "todos",
    "backlog": "backlog",
    "overdue": "backlog",
}


@dataclass
class CommandContext:
    chat_id: str
    telegram_user_id: str
    telegram_username: str | None
    text: str
    user: User | None


class TelegramCommandHandler:
    def __init__(self, db: Session):
        self.db = db
        self.link = TelegramLinkService(db)
        self.tasks = TelegramTaskService(db)
        self.client = TelegramClient()
        self.ai = OpenRouterService()

    def handle_update(self, update: dict) -> None:
        message = update.get("message") or update.get("edited_message")
        if not message:
            return
        chat = message.get("chat") or {}
        from_user = message.get("from") or {}
        text = (message.get("text") or "").strip()
        if not text:
            return

        chat_id = str(chat.get("id"))
        tg_uid = str(from_user.get("id"))
        username = from_user.get("username")

        user = self.link.resolve_linked_user(tg_uid)
        ctx = CommandContext(
            chat_id=chat_id,
            telegram_user_id=tg_uid,
            telegram_username=username,
            text=text,
            user=user,
        )
        reply = self.dispatch(ctx)
        if reply:
            self.client.send_message(chat_id, reply)

    def dispatch(self, ctx: CommandContext) -> str:
        raw = ctx.text.strip()
        # Strip bot mention: /today@supershyftbot
        if raw.startswith("/"):
            parts = raw.split(maxsplit=1)
            cmd = parts[0].split("@", 1)[0].lower()
            arg = parts[1].strip() if len(parts) > 1 else ""
        else:
            # Free-text alias: "pratheek today"
            return self._handle_free_text(ctx, raw)

        if cmd in ("/start", "/help"):
            if cmd == "/start" and arg:
                return self._link(ctx, arg)
            return format_help(settings.TELEGRAM_BOT_USERNAME or "supershyftbot")

        if cmd == "/link":
            if not arg:
                return "Usage: /link CODE\nGenerate a code in Supershyft Task Tracker → Settings → Telegram."
            return self._link(ctx, arg)

        if cmd == "/unlink":
            if not ctx.user:
                return "You are not linked."
            self.link.unlink_user(ctx.user)
            return "Telegram unlinked from your Supershyft Task Tracker account."

        # Remaining commands require link
        if not ctx.user:
            return (
                "Your Telegram is not linked to Supershyft Task Tracker.\n"
                "Open Supershyft Task Tracker → Settings → Telegram, generate a code, then send:\n"
                "/link CODE"
            )

        if cmd == "/today":
            return self._self_filter(ctx.user, "today")
        if cmd == "/wip":
            return self._self_filter(ctx.user, "wip")
        if cmd in ("/todos", "/todo"):
            return self._self_filter(ctx.user, "todos")
        if cmd == "/backlog":
            return self._self_filter(ctx.user, "backlog")

        week_match = re.fullmatch(r"/w([1-4])", cmd)
        if week_match:
            return self._self_week(ctx.user, int(week_match.group(1)))

        if cmd == "/user":
            return self._user_command(ctx, arg)

        if cmd == "/team":
            return self._team_command(ctx, arg)

        if cmd == "/summary":
            return self._summary_command(ctx, arg)

        return "Unknown command. Send /help for the list."

    def _link(self, ctx: CommandContext, code: str) -> str:
        user, err = self.link.link_with_code(
            code=code,
            telegram_user_id=ctx.telegram_user_id,
            chat_id=ctx.chat_id,
            telegram_username=ctx.telegram_username,
        )
        if err:
            return err
        assert user is not None
        return f"Linked as {user.full_name} ({user.role}). Try /today or /help."

    def _require_manager(self, user: User) -> str | None:
        if not self.tasks.is_manager(user):
            return "Only managers and administrators can view other people's tasks."
        return None

    def _self_filter(self, user: User, kind: str) -> str:
        tasks, _ = self._query_filter(user.id, kind)
        title = f"{kind.upper() if kind != 'today' else 'Today'} — {user.full_name}"
        if kind == "today":
            title = f"Today — {user.full_name}"
        elif kind == "wip":
            title = f"WIP — {user.full_name}"
        elif kind == "todos":
            title = f"TODOs — {user.full_name}"
        elif kind == "backlog":
            title = f"Backlog (overdue) — {user.full_name}"
        return format_task_list(title, tasks)

    def _self_week(self, user: User, week: int) -> str:
        tasks, _ = self.tasks.tasks_month_week(user.id, week)
        return format_task_list(f"Week {week} (this month) — {user.full_name}", tasks)

    def _query_filter(self, assignee_id: int, kind: str):
        if kind == "today":
            return self.tasks.tasks_today(assignee_id)
        if kind == "wip":
            return self.tasks.tasks_by_status(assignee_id, "in_progress")
        if kind == "todos":
            return self.tasks.tasks_by_status(assignee_id, "to_do")
        if kind == "backlog":
            return self.tasks.tasks_backlog(assignee_id)
        return [], 0

    def _resolve_target(self, requester: User, name: str) -> tuple[User | None, str]:
        matches = self.tasks.resolve_users_by_name(name)
        if not matches:
            return None, f'No user matching "{name}".'
        if len(matches) > 1:
            opts = ", ".join(u.full_name for u in matches[:5])
            return None, f"Multiple matches: {opts}. Use a more specific name."
        target = matches[0]
        if target.id != requester.id:
            denied = self._require_manager(requester)
            if denied:
                return None, denied
        return target, ""

    def _user_command(self, ctx: CommandContext, arg: str) -> str:
        assert ctx.user is not None
        parts = arg.split()
        if len(parts) < 2:
            return "Usage: /user NAME today|wip|todos|backlog"
        filter_token = parts[-1].lower()
        kind = FILTER_ALIASES.get(filter_token)
        if not kind:
            return "Usage: /user NAME today|wip|todos|backlog"
        name = " ".join(parts[:-1])
        target, err = self._resolve_target(ctx.user, name)
        if err:
            return err
        assert target is not None
        tasks, _ = self._query_filter(target.id, kind)
        labels = {
            "today": f"Today — {target.full_name}",
            "wip": f"WIP — {target.full_name}",
            "todos": f"TODOs — {target.full_name}",
            "backlog": f"Backlog (overdue) — {target.full_name}",
        }
        return format_task_list(labels[kind], tasks)

    def _team_command(self, ctx: CommandContext, arg: str) -> str:
        assert ctx.user is not None
        denied = self._require_manager(ctx.user)
        if denied:
            return denied
        if arg.strip().lower() not in ("", "today"):
            return "Usage: /team today"
        rows = self.tasks.team_today_snapshot()
        return format_team_snapshot(rows)

    def _summary_command(self, ctx: CommandContext, arg: str) -> str:
        assert ctx.user is not None
        target = ctx.user
        if arg.strip():
            target, err = self._resolve_target(ctx.user, arg.strip())
            if err:
                return err
            assert target is not None

        tasks, _ = self.tasks.tasks_today(target.id)
        title = f"Today summary — {target.full_name}"
        fallback = format_task_list(title, tasks)
        payload = self.tasks.tasks_to_summary_payload(tasks, assignee_name=target.full_name)
        ai_text = self.ai.summarize_tasks(title=title, tasks=payload)
        if ai_text:
            return f"{title}\n\n{ai_text}"
        return fallback + ("\n\n(AI summary unavailable — showing list.)" if tasks else "")

    def _handle_free_text(self, ctx: CommandContext, raw: str) -> str:
        if not ctx.user:
            return (
                "Link your account first.\n"
                "Supershyft Task Tracker → Settings → Telegram → generate code → /link CODE"
            )
        parts = raw.lower().split()
        if len(parts) >= 2 and parts[-1] in FILTER_ALIASES:
            # "pratheek today"
            return self._user_command(ctx, raw)
        return "Send /help for available commands."
