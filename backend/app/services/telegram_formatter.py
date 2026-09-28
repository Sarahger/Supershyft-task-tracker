"""Format Telegram replies (plain text; escape-safe)."""

from __future__ import annotations

from app.models import Task
from app.services.telegram_task_service import TelegramTaskService

MAX_ITEMS = 20


def format_task_list(title: str, tasks: list[Task], *, empty_message: str | None = None) -> str:
    if not tasks:
        return empty_message or f"{title}\n\nNo tasks found."
    lines = [title, ""]
    shown = tasks[:MAX_ITEMS]
    for i, task in enumerate(shown, start=1):
        lines.append(f"{i}. {TelegramTaskService.task_line(task)}")
    remaining = len(tasks) - len(shown)
    if remaining > 0:
        lines.append(f"\n…and {remaining} more")
    return "\n".join(lines)


def format_help(bot_username: str = "supershyftbot") -> str:
    return "\n".join(
        [
            f"@{bot_username} — Work OS task bot",
            "",
            "Link your account (from Work OS Settings):",
            "/link CODE",
            "",
            "Your tasks:",
            "/today — due today (+ overdue WIP)",
            "/wip — in progress",
            "/todos — to do",
            "/backlog — overdue",
            "/w1 /w2 /w3 /w4 — week of this month",
            "/summary — short summary (AI if available)",
            "",
            "Managers:",
            "/user NAME today|wip|todos|backlog",
            "/team today",
            "/summary NAME",
            "",
            "/help — this message",
            "/unlink — disconnect Telegram (also available in Settings)",
        ]
    )


def format_team_snapshot(rows: list[dict]) -> str:
    if not rows:
        return "Team today\n\nNo open activity found."
    lines = ["Team today", ""]
    for row in rows[:40]:
        u = row["user"]
        lines.append(
            f"• {u.full_name}: today {row['today_count']}, "
            f"WIP {row['wip_count']}, overdue {row['overdue_count']}"
        )
    return "\n".join(lines)
