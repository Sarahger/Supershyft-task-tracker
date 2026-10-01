"""Parse and handle Telegram bot commands."""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from datetime import timedelta

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models import User
from app.services.attendance_service import AttendanceService, today_local
from app.services.daily_update_service import DailyUpdateService
from app.services.telegram_client import TelegramClient
from app.services.telegram_formatter import (
    format_attendance_day,
    format_attendance_month,
    format_attendance_week,
    format_daily_updates,
    format_help,
    format_task_list,
    format_team_snapshot,
)
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
        self.attendance = AttendanceService(db)
        self.daily_updates = DailyUpdateService(db)
        self.client = TelegramClient()

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
                return (
                    "Usage: /link CODE\n"
                    "Generate a code in Settings → Telegram."
                )
            return self._link(ctx, arg)

        if cmd == "/unlink":
            if not ctx.user:
                return "Not linked yet."
            self.link.unlink_user(ctx.user)
            return "Unlinked. You can link again anytime from Settings → Telegram."

        # Remaining commands require link
        if not ctx.user:
            return (
                "Account not linked.\n\n"
                "1. Open Supershyft Task Tracker → Settings → Telegram\n"
                "2. Generate a link code\n"
                "3. Send: /link CODE"
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

        if cmd == "/attendance":
            return self._attendance_command(ctx, arg)

        if cmd in ("/dailyupdates", "/dailyupdate", "/daily"):
            # Support: /daily updates sarah  → strip leading "updates"
            cleaned = arg
            lower = arg.lower()
            if lower.startswith("updates "):
                cleaned = arg[8:].strip()
            elif lower == "updates":
                cleaned = ""
            return self._daily_updates_command(ctx, cleaned)

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
        return f"Linked as {user.full_name} ({user.role}).\nTry /today or /help."

    def _require_manager(self, user: User) -> str | None:
        if not self.tasks.is_manager(user):
            return "Managers only."
        return None

    def _self_filter(self, user: User, kind: str) -> str:
        tasks, _ = self._query_filter(user.id, kind)
        labels = {
            "today": f"Today · {user.full_name}",
            "wip": f"WIP · {user.full_name}",
            "todos": f"TODOs · {user.full_name}",
            "backlog": f"Backlog · {user.full_name}",
        }
        return format_task_list(labels.get(kind, user.full_name), tasks)

    def _self_week(self, user: User, week: int) -> str:
        tasks, _ = self.tasks.tasks_month_week(user.id, week)
        return format_task_list(f"Week {week} · {user.full_name}", tasks)

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
            "today": f"Today · {target.full_name}",
            "wip": f"WIP · {target.full_name}",
            "todos": f"TODOs · {target.full_name}",
            "backlog": f"Backlog · {target.full_name}",
        }
        return format_task_list(labels[kind], tasks)

    def _team_command(self, ctx: CommandContext, arg: str) -> str:
        assert ctx.user is not None
        denied = self._require_manager(ctx.user)
        if denied:
            return denied

        raw = arg.strip()
        lower = raw.lower()
        if lower in ("", "today", "snapshot"):
            rows = self.tasks.team_today_snapshot()
            return format_team_snapshot(rows)

        # /team design | /team tech today | /team design wip
        parts = raw.split()
        filter_kind = None
        if parts and parts[-1].lower() in FILTER_ALIASES:
            filter_kind = FILTER_ALIASES[parts[-1].lower()]
            dept_name = " ".join(parts[:-1]).strip()
        else:
            dept_name = raw

        if not dept_name:
            names = ", ".join(self.tasks.list_department_names()) or "(none)"
            return (
                "Usage:\n"
                "/team today\n"
                "/team DESIGN\n"
                "/team tech today|wip|todos|backlog\n\n"
                f"Departments: {names}"
            )

        dept, matches = self.tasks.resolve_department_by_name(dept_name)
        if not dept:
            if matches:
                opts = ", ".join(d.name for d in matches[:8])
                return f"Multiple departments match \"{dept_name}\": {opts}"
            names = ", ".join(self.tasks.list_department_names()) or "(none)"
            return f'No department matching "{dept_name}".\nAvailable: {names}'

        tasks, _ = self.tasks.tasks_for_department(dept.id, kind=filter_kind)
        kind_label = {
            None: "Open tasks",
            "today": "Today",
            "wip": "WIP",
            "todos": "TODOs",
            "backlog": "Backlog",
        }.get(filter_kind, "Tasks")
        title = f"{dept.name} · {kind_label}"
        return format_task_list(title, tasks, show_assignee=True)

    def _attendance_command(self, ctx: CommandContext, arg: str) -> str:
        assert ctx.user is not None
        parts = arg.split()
        if not parts:
            return (
                "Usage:\n"
                "/attendance today\n"
                "/attendance week [NAME]\n"
                "/attendance month [NAME]"
            )

        scope = parts[0].lower()
        name = " ".join(parts[1:]).strip()

        if scope == "today":
            if name:
                return "Usage: /attendance today\n(For one person use /attendance week NAME or /attendance month NAME)"
            denied = self._require_manager(ctx.user)
            if denied:
                # Employees see only their own mark for today
                me = self.attendance.get_today(ctx.user)
                status = me.get("status") if me else "Not marked"
                return f"Attendance today · {ctx.user.full_name}\n\n{status}"
            data = self.attendance.get_day()
            return format_attendance_day(data)

        if scope in ("week", "weekly"):
            target = ctx.user
            if name:
                target, err = self._resolve_target(ctx.user, name)
                if err:
                    return err
                assert target is not None
            data = self.attendance.get_me(target)
            week_start = data["today"] - timedelta(days=data["today"].weekday())
            return format_attendance_week(target.full_name, data.get("week") or [], week_start=week_start)

        if scope in ("month", "monthly"):
            target = ctx.user
            if name:
                target, err = self._resolve_target(ctx.user, name)
                if err:
                    return err
                assert target is not None
            if target.id == ctx.user.id:
                data = self.attendance.get_me(target)
            else:
                data = self.attendance.get_user_detail(target.id)
            return format_attendance_month(target.full_name, data)

        return (
            "Usage:\n"
            "/attendance today\n"
            "/attendance week [NAME]\n"
            "/attendance month [NAME]"
        )

    def _daily_updates_command(self, ctx: CommandContext, arg: str) -> str:
        assert ctx.user is not None

        day = today_local()
        token = arg.strip()
        lower = token.lower()

        if not token:
            data = self.daily_updates.get_day(ctx.user, day)
            own = data.get("own_update")
            updates = [own] if own else []
            return format_daily_updates(f"Daily update · {ctx.user.full_name} · {day.strftime('%d-%m-%y')}", updates)

        if lower in ("today", "team"):
            denied = self._require_manager(ctx.user)
            if denied:
                return denied
            data = self.daily_updates.get_day(ctx.user, day)
            updates = []
            if data.get("own_update"):
                updates.append(data["own_update"])
            updates.extend(data.get("team_updates") or [])
            return format_daily_updates(f"Daily updates · {day.strftime('%d-%m-%y')}", updates)

        if lower == "yesterday":
            day = day - timedelta(days=1)
            data = self.daily_updates.get_day(ctx.user, day)
            own = data.get("own_update")
            updates = [own] if own else []
            return format_daily_updates(f"Daily update · {ctx.user.full_name} · {day.strftime('%d-%m-%y')}", updates)

        # Optional trailing today/yesterday: "sarah today"
        name_parts = token.split()
        day_word = None
        if name_parts and name_parts[-1].lower() in ("today", "yesterday"):
            day_word = name_parts[-1].lower()
            name_parts = name_parts[:-1]
        if day_word == "yesterday":
            day = today_local() - timedelta(days=1)
        name = " ".join(name_parts).strip()
        if not name:
            return "Usage: /dailyupdates NAME"

        target, err = self._resolve_target(ctx.user, name)
        if err:
            return err
        assert target is not None

        data = self.daily_updates.get_day(ctx.user, day, filter_user_id=target.id)
        updates = list(data.get("team_updates") or [])
        # When filtering self, own_update is populated instead
        if target.id == ctx.user.id and data.get("own_update"):
            updates = [data["own_update"]]
        return format_daily_updates(
            f"Daily update · {target.full_name} · {day.strftime('%d-%m-%y')}",
            updates,
        )

    def _handle_free_text(self, ctx: CommandContext, raw: str) -> str:
        if not ctx.user:
            return (
                "Account not linked.\n\n"
                "Open Settings → Telegram, generate a code, then send /link CODE"
            )
        lower = raw.lower().strip()
        if lower.startswith("attendance "):
            return self._attendance_command(ctx, raw[len("attendance ") :].strip())
        if lower.startswith("daily updates "):
            return self._daily_updates_command(ctx, raw[len("daily updates ") :].strip())
        if lower.startswith("daily update "):
            return self._daily_updates_command(ctx, raw[len("daily update ") :].strip())
        parts = lower.split()
        if len(parts) >= 2 and parts[-1] in FILTER_ALIASES:
            return self._user_command(ctx, raw)
        return "Unknown request. Send /help."
