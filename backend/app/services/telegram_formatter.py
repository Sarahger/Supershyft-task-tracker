"""Format Telegram replies for mobile readability (plain text)."""

from __future__ import annotations

from datetime import date, timedelta

from app.models import Task
from app.services.telegram_task_service import STATUS_LABELS, TelegramTaskService, format_estimated_duration
from app.utils.month_weeks import get_app_timezone

MAX_ITEMS = 15
MAX_UPDATE_CHARS = 400
MAX_MESSAGE_CHARS = 3900


def clamp_message(text: str, limit: int = MAX_MESSAGE_CHARS) -> str:
    text = (text or "").rstrip()
    if len(text) <= limit:
        return text
    return text[: limit - 20].rstrip() + "\n\n…(truncated)"


def format_task_block(task: Task, index: int, *, show_assignee: bool = False) -> str:
    """One task as a compact multi-line block."""
    title = (task.title or "").strip() or f"Task #{task.id}"
    status = STATUS_LABELS.get(task.status, task.status)
    meta: list[str] = [status]
    if task.due_date:
        due = task.due_date.astimezone(get_app_timezone()).strftime("%d-%m-%y")
        meta.append(f"due {due}")
    meta.append(format_estimated_duration(task.estimated_hours))
    lines = [f"{index}. {title}"]
    if show_assignee:
        lines.append(f"   @{TelegramTaskService.assignee_names(task)}")
    lines.append(f"   {' · '.join(meta)}")
    return "\n".join(lines)


def format_task_list(
    title: str,
    tasks: list[Task],
    *,
    empty_message: str | None = None,
    show_assignee: bool = False,
) -> str:
    if not tasks:
        return clamp_message(empty_message or f"{title}\n\nNo tasks found.")
    lines = [title, f"{len(tasks)} task(s)", ""]
    shown = tasks[:MAX_ITEMS]
    for i, task in enumerate(shown, start=1):
        lines.append(format_task_block(task, i, show_assignee=show_assignee))
        lines.append("")
    remaining = len(tasks) - len(shown)
    if remaining > 0:
        lines.append(f"…and {remaining} more")
    return clamp_message("\n".join(lines).rstrip())


def format_help(bot_username: str = "supershyftbot") -> str:
    return clamp_message(
        "\n".join(
            [
                f"Supershyft Task Tracker (@{bot_username})",
                "",
                "Setup",
                "/link CODE — connect your account",
                "/unlink — disconnect",
                "",
                "My tasks",
                "/today",
                "/wip",
                "/todos",
                "/backlog",
                "/w1 /w2 /w3 /w4 — week of this month",
                "",
                "Attendance",
                "/attendance today",
                "/attendance week [name]",
                "/attendance month [name]",
                "",
                "Daily updates",
                "/dailyupdates",
                "/dailyupdates today",
                "/dailyupdates [name]",
                "",
                "Managers",
                "/user [name] today|wip|todos|backlog",
                "/team today — everyone snapshot",
                "/team design — Design department tasks",
                "/team tech today — Technology tasks due today",
                "",
                "/help",
            ]
        )
    )


def format_team_snapshot(rows: list[dict]) -> str:
    if not rows:
        return "Team today\n\nNo open activity."
    lines = [f"Team today · {len(rows)} people", ""]
    for row in rows[:35]:
        u = row["user"]
        lines.append(
            f"• {u.full_name}\n"
            f"   today {row['today_count']} · WIP {row['wip_count']} · overdue {row['overdue_count']}"
        )
    if len(rows) > 35:
        lines.append(f"\n…and {len(rows) - 35} more")
    return clamp_message("\n".join(lines))


def _person_name(brief: dict | None) -> str:
    if not brief:
        return "Unknown"
    return (
        brief.get("full_name")
        or f"{brief.get('first_name', '')} {brief.get('last_name', '')}".strip()
        or brief.get("name")
        or "Unknown"
    )


def format_attendance_day(data: dict) -> str:
    day = data.get("date")
    day_label = day.strftime("%d-%m-%y") if isinstance(day, date) else str(day)
    stats = data.get("stats") or {}
    people = stats.get("people") or {}
    lines = [
        f"Attendance · {day_label}",
        (
            f"WFO {stats.get('present_wfo', 0)} · WFH {stats.get('wfh', 0)} · "
            f"Leave {stats.get('on_leave', 0)} · Half {stats.get('half_day', 0)} · "
            f"Camp {stats.get('camp', 0)} · Open {stats.get('not_marked', 0)}"
        ),
    ]

    sections = [
        ("WFO", people.get("present_wfo") or []),
        ("WFH", people.get("wfh") or []),
        ("Leave", people.get("on_leave") or []),
        ("Half-day", people.get("half_day") or []),
        ("Camp", people.get("camp") or []),
        ("Not marked", people.get("not_marked") or []),
    ]
    for label, group in sections:
        if not group:
            continue
        names = ", ".join(_person_name(p) for p in group[:25])
        extra = f" (+{len(group) - 25})" if len(group) > 25 else ""
        lines.append("")
        lines.append(f"{label} ({len(group)})")
        lines.append(names + extra)
    return clamp_message("\n".join(lines))


def format_attendance_week(name: str, week: list[dict | None], *, week_start: date | None = None) -> str:
    labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    lines = [f"Attendance week · {name}", ""]
    for i, rec in enumerate(week[:7]):
        day_name = labels[i] if i < len(labels) else f"D{i + 1}"
        if week_start is not None:
            d = week_start + timedelta(days=i)
            day_name = f"{labels[i]} {d.strftime('%d-%m')}"
        status = (rec.get("status") if rec else None) or "—"
        lines.append(f"{day_name}  {status}")
    return clamp_message("\n".join(lines))


def format_attendance_month(name: str, data: dict) -> str:
    year = data.get("year")
    month = data.get("month")
    summary = data.get("summary") or {}
    records = data.get("records") or []
    working = summary.get("working_days", "?")
    pct = summary.get("attendance_percent")
    pct_part = f" · {pct}%" if pct is not None else ""
    lines = [
        f"Attendance {int(month):02d}-{year} · {name}",
        (
            f"WFO {summary.get('wfo_count', 0)} · WFH {summary.get('wfh_count', 0)} · "
            f"Leave {summary.get('leave_count', 0)} · Half {summary.get('half_day_count', 0)} · "
            f"Camp {summary.get('camp_count', 0)}"
        ),
        f"Present {summary.get('present_count', 0)}/{working} working days{pct_part}",
        "",
    ]
    if not records:
        lines.append("No records this month.")
        return clamp_message("\n".join(lines))
    for rec in records[:31]:
        d = rec.get("attendance_date")
        d_label = d.strftime("%d-%m") if isinstance(d, date) else str(d)
        lines.append(f"{d_label}  {rec.get('status')}")
    if len(records) > 31:
        lines.append(f"…and {len(records) - 31} more")
    return clamp_message("\n".join(lines))


def _clip(text: str, limit: int = MAX_UPDATE_CHARS) -> str:
    text = (text or "").strip()
    if len(text) <= limit:
        return text
    return text[: limit - 1].rstrip() + "…"


def format_daily_updates(title: str, updates: list[dict]) -> str:
    if not updates:
        return clamp_message(f"{title}\n\nNo daily updates.")
    lines = [title, f"{len(updates)} update(s)", ""]
    for item in updates[:12]:
        author = _person_name(item.get("author"))
        content = _clip(item.get("content") or "")
        lines.append(f"• {author}")
        if content:
            for line in content.splitlines()[:8]:
                if line.strip():
                    lines.append(f"  {line.strip()}")
        else:
            lines.append("  (no text)")
        tasks = item.get("tasks") or []
        if tasks:
            titles = ", ".join((t.get("title") or "?")[:40] for t in tasks[:4])
            lines.append(f"  Tasks: {titles}")
        lines.append("")
    if len(updates) > 12:
        lines.append(f"…and {len(updates) - 12} more")
    return clamp_message("\n".join(lines).rstrip())
