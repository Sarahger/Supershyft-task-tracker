"""Format Telegram replies (plain text; escape-safe)."""

from __future__ import annotations

from datetime import date, timedelta

from app.models import Task
from app.services.telegram_task_service import TelegramTaskService

MAX_ITEMS = 20
MAX_UPDATE_CHARS = 600


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
            f"@{bot_username} — Supershyft Task Tracker",
            "",
            "Link your account (from Settings):",
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
            "Attendance:",
            "/attendance today — team attendance today (managers)",
            "/attendance week [NAME] — week for you or a person",
            "/attendance month [NAME] — month for you or a person",
            "",
            "Daily updates:",
            "/dailyupdates — your update today",
            "/dailyupdates today — everyone's updates today (managers)",
            "/dailyupdates NAME — that person's update today",
            "",
            "Managers (tasks):",
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
        f"Attendance — {day_label}",
        "",
        f"WFO {stats.get('present_wfo', 0)} · WFH {stats.get('wfh', 0)} · "
        f"Leave {stats.get('on_leave', 0)} · Half-day {stats.get('half_day', 0)} · "
        f"Camp {stats.get('camp', 0)} · Not marked {stats.get('not_marked', 0)}",
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
        lines.append("")
        lines.append(f"{label}:")
        for p in group[:30]:
            lines.append(f"• {_person_name(p)}")
        if len(group) > 30:
            lines.append(f"…and {len(group) - 30} more")
    return "\n".join(lines)


def format_attendance_week(name: str, week: list[dict | None], *, week_start: date | None = None) -> str:
    labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    lines = [f"Attendance week — {name}", ""]
    for i, rec in enumerate(week[:7]):
        day_name = labels[i] if i < len(labels) else f"D{i + 1}"
        if week_start is not None:
            d = week_start + timedelta(days=i)
            day_name = f"{labels[i]} {d.strftime('%d-%m')}"
        status = rec.get("status") if rec else "—"
        lines.append(f"{day_name}: {status or '—'}")
    return "\n".join(lines)


def format_attendance_month(name: str, data: dict) -> str:
    year = data.get("year")
    month = data.get("month")
    summary = data.get("summary") or {}
    records = data.get("records") or []
    working = summary.get("working_days", "?")
    pct = summary.get("attendance_percent")
    pct_part = f" ({pct}%)" if pct is not None else ""
    lines = [
        f"Attendance {int(month):02d}-{year} — {name}",
        "",
        f"WFO {summary.get('wfo_count', 0)} · WFH {summary.get('wfh_count', 0)} · "
        f"Leave {summary.get('leave_count', 0)} · Half-day {summary.get('half_day_count', 0)} · "
        f"Camp {summary.get('camp_count', 0)}",
        f"Present {summary.get('present_count', 0)} / {working} working days{pct_part}",
        "",
    ]
    if not records:
        lines.append("No attendance records this month.")
        return "\n".join(lines)
    for rec in records[:40]:
        d = rec.get("attendance_date")
        d_label = d.strftime("%d-%m-%y") if isinstance(d, date) else str(d)
        lines.append(f"• {d_label}: {rec.get('status')}")
    if len(records) > 40:
        lines.append(f"…and {len(records) - 40} more")
    return "\n".join(lines)


def _clip(text: str, limit: int = MAX_UPDATE_CHARS) -> str:
    text = (text or "").strip()
    if len(text) <= limit:
        return text
    return text[: limit - 1].rstrip() + "…"


def format_daily_updates(title: str, updates: list[dict]) -> str:
    if not updates:
        return f"{title}\n\nNo daily updates found."
    lines = [title, ""]
    for item in updates[:15]:
        author = _person_name(item.get("author"))
        content = _clip(item.get("content") or "")
        lines.append(f"• {author}:")
        if content:
            for line in content.splitlines()[:12]:
                lines.append(f"  {line}" if line.strip() else "")
        else:
            lines.append("  (empty)")
        tasks = item.get("tasks") or []
        if tasks:
            titles = ", ".join(t.get("title", "?") for t in tasks[:5])
            lines.append(f"  Tasks: {titles}")
        lines.append("")
    if len(updates) > 15:
        lines.append(f"…and {len(updates) - 15} more")
    return "\n".join(lines).rstrip()
