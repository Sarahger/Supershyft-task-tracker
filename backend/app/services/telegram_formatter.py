"""Format Telegram replies for mobile readability (HTML + plain text)."""

from __future__ import annotations

from datetime import date, timedelta
from html import escape

from app.models import Task
from app.services.telegram_task_service import STATUS_LABELS, TelegramTaskService, format_estimated_duration
from app.utils.month_weeks import get_app_timezone

MAX_ITEMS = 20
MAX_UPDATE_CHARS = 400
MAX_MESSAGE_CHARS = 3900


def clamp_message(text: str, limit: int = MAX_MESSAGE_CHARS) -> str:
    text = (text or "").rstrip()
    if len(text) <= limit:
        return text
    # Prefer cutting before closing </pre> if present
    if "</pre>" in text and len(text) > limit:
        cut = text.rfind("\n", 0, limit - 30)
        if cut > 0:
            body = text[:cut].rstrip()
            if "<pre>" in body and "</pre>" not in body:
                body += "\n…</pre>"
            else:
                body += "\n\n…(truncated)"
            return body
    return text[: limit - 20].rstrip() + "\n\n…(truncated)"


def _pad(text: str, width: int) -> str:
    text = (text or "").replace("\n", " ").strip()
    if len(text) > width:
        return text[: width - 1] + "…"
    return text.ljust(width)


def _due_label(task: Task) -> str:
    if not task.due_date:
        return "—"
    return task.due_date.astimezone(get_app_timezone()).strftime("%d-%m-%y")


def _status_short(task: Task) -> str:
    return STATUS_LABELS.get(task.status, task.status or "—")


def _assignee_short(task: Task, width: int = 12) -> str:
    name = TelegramTaskService.assignee_names(task)
    # Prefer first name for narrow columns when single assignee
    if "," not in name and " " in name:
        first = name.split()[0]
        if len(name) > width:
            name = first
    return _pad(name, width)


def format_task_table(
    title: str,
    tasks: list[Task],
    *,
    empty_message: str | None = None,
    show_assignee: bool = False,
) -> str:
    """Aligned monospace table inside <pre> for Telegram HTML mode."""
    if not tasks:
        return clamp_message(empty_message or f"<b>{escape(title)}</b>\n\nNo tasks found.")

    header_title = f"<b>{escape(title)}</b>\n{len(tasks)} task(s)\n"
    if show_assignee:
        header = f"{'#':<2} {_pad('Who', 12)} {_pad('Status', 8)} {_pad('Due', 8)} {_pad('Time', 6)} Task"
        sep = "-" * 56
        rows: list[str] = []
        for i, task in enumerate(tasks[:MAX_ITEMS], start=1):
            title_txt = (task.title or "").strip() or f"Task #{task.id}"
            rows.append(
                f"{i:<2} {_assignee_short(task, 12)} {_pad(_status_short(task), 8)} "
                f"{_pad(_due_label(task), 8)} {_pad(format_estimated_duration(task.estimated_hours), 6)} "
                f"{_pad(title_txt, 28)}"
            )
    else:
        header = f"{'#':<2} {_pad('Status', 8)} {_pad('Due', 8)} {_pad('Time', 6)} Task"
        sep = "-" * 48
        rows = []
        for i, task in enumerate(tasks[:MAX_ITEMS], start=1):
            title_txt = (task.title or "").strip() or f"Task #{task.id}"
            rows.append(
                f"{i:<2} {_pad(_status_short(task), 8)} {_pad(_due_label(task), 8)} "
                f"{_pad(format_estimated_duration(task.estimated_hours), 6)} {_pad(title_txt, 32)}"
            )

    body = "\n".join([header, sep, *rows])
    remaining = len(tasks) - min(len(tasks), MAX_ITEMS)
    footer = f"\n…and {remaining} more" if remaining > 0 else ""
    return clamp_message(f"{header_title}<pre>{escape(body)}</pre>{escape(footer)}")


def format_task_list(
    title: str,
    tasks: list[Task],
    *,
    empty_message: str | None = None,
    show_assignee: bool = False,
) -> str:
    return format_task_table(title, tasks, empty_message=empty_message, show_assignee=show_assignee)


def format_tasks_grouped_by_assignee(title: str, tasks: list[Task]) -> str:
    """Group tasks under each assignee — clearer for /today all."""
    if not tasks:
        return clamp_message(f"<b>{escape(title)}</b>\n\nNo tasks found.")

    groups: dict[str, list[Task]] = {}
    for task in tasks:
        key = TelegramTaskService.assignee_names(task)
        groups.setdefault(key, []).append(task)

    parts = [f"<b>{escape(title)}</b>", f"{len(tasks)} task(s) · {len(groups)} people", ""]
    shown = 0
    for person in sorted(groups.keys(), key=lambda n: n.lower()):
        person_tasks = groups[person]
        parts.append(f"<b>{escape(person)}</b> ({len(person_tasks)})")
        header = f"{'#':<2} {_pad('Status', 8)} {_pad('Due', 8)} {_pad('Time', 6)} Task"
        rows = []
        for i, task in enumerate(person_tasks, start=1):
            if shown >= MAX_ITEMS:
                break
            title_txt = (task.title or "").strip() or f"Task #{task.id}"
            rows.append(
                f"{i:<2} {_pad(_status_short(task), 8)} {_pad(_due_label(task), 8)} "
                f"{_pad(format_estimated_duration(task.estimated_hours), 6)} {_pad(title_txt, 28)}"
            )
            shown += 1
        parts.append(f"<pre>{escape(header)}\n{escape('-' * 48)}\n" + escape("\n".join(rows)) + "</pre>")
        parts.append("")
        if shown >= MAX_ITEMS:
            break

    remaining = len(tasks) - shown
    if remaining > 0:
        parts.append(f"…and {remaining} more")
    return clamp_message("\n".join(parts).rstrip())


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
                "/today all — everyone's tasks today (managers)",
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
    header = f"{_pad('Name', 16)} {_pad('Today', 5)} {_pad('WIP', 4)} Overdue"
    rows_txt = []
    for row in rows[:35]:
        u = row["user"]
        rows_txt.append(
            f"{_pad(u.full_name, 16)} {_pad(str(row['today_count']), 5)} "
            f"{_pad(str(row['wip_count']), 4)} {row['overdue_count']}"
        )
    body = "\n".join([header, "-" * 36, *rows_txt])
    extra = f"\n…and {len(rows) - 35} more" if len(rows) > 35 else ""
    return clamp_message(f"<b>Team today</b> · {len(rows)} people\n<pre>{escape(body)}</pre>{escape(extra)}")


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
        f"<b>Attendance · {escape(day_label)}</b>",
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
        lines.append(f"<b>{escape(label)}</b> ({len(group)})")
        lines.append(escape(names + extra))
    return clamp_message("\n".join(lines))


def format_attendance_week(name: str, week: list[dict | None], *, week_start: date | None = None) -> str:
    labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    rows = []
    for i, rec in enumerate(week[:7]):
        day_name = labels[i] if i < len(labels) else f"D{i + 1}"
        if week_start is not None:
            d = week_start + timedelta(days=i)
            day_name = f"{labels[i]} {d.strftime('%d-%m')}"
        status = (rec.get("status") if rec else None) or "—"
        rows.append(f"{_pad(day_name, 10)} {status}")
    body = "\n".join(rows)
    return clamp_message(f"<b>Attendance week · {escape(name)}</b>\n<pre>{escape(body)}</pre>")


def format_attendance_month(name: str, data: dict) -> str:
    year = data.get("year")
    month = data.get("month")
    summary = data.get("summary") or {}
    records = data.get("records") or []
    working = summary.get("working_days", "?")
    pct = summary.get("attendance_percent")
    pct_part = f" · {pct}%" if pct is not None else ""
    head = [
        f"<b>Attendance {int(month):02d}-{year} · {escape(name)}</b>",
        (
            f"WFO {summary.get('wfo_count', 0)} · WFH {summary.get('wfh_count', 0)} · "
            f"Leave {summary.get('leave_count', 0)} · Half {summary.get('half_day_count', 0)} · "
            f"Camp {summary.get('camp_count', 0)}"
        ),
        f"Present {summary.get('present_count', 0)}/{working} working days{pct_part}",
    ]
    if not records:
        return clamp_message("\n".join(head) + "\n\nNo records this month.")
    rows = []
    for rec in records[:31]:
        d = rec.get("attendance_date")
        d_label = d.strftime("%d-%m") if isinstance(d, date) else str(d)
        rows.append(f"{_pad(d_label, 6)} {rec.get('status')}")
    extra = f"\n…and {len(records) - 31} more" if len(records) > 31 else ""
    return clamp_message("\n".join(head) + f"\n<pre>{escape(chr(10).join(rows))}</pre>{escape(extra)}")


def _clip(text: str, limit: int = MAX_UPDATE_CHARS) -> str:
    text = (text or "").strip()
    if len(text) <= limit:
        return text
    return text[: limit - 1].rstrip() + "…"


def format_daily_updates(title: str, updates: list[dict]) -> str:
    if not updates:
        return clamp_message(f"<b>{escape(title)}</b>\n\nNo daily updates.")
    lines = [f"<b>{escape(title)}</b>", f"{len(updates)} update(s)", ""]
    for item in updates[:12]:
        author = _person_name(item.get("author"))
        content = _clip(item.get("content") or "")
        lines.append(f"<b>{escape(author)}</b>")
        if content:
            for line in content.splitlines()[:8]:
                if line.strip():
                    lines.append(escape(line.strip()))
        else:
            lines.append("(no text)")
        tasks = item.get("tasks") or []
        if tasks:
            titles = ", ".join((t.get("title") or "?")[:40] for t in tasks[:4])
            lines.append(escape(f"Tasks: {titles}"))
        lines.append("")
    if len(updates) > 12:
        lines.append(f"…and {len(updates) - 12} more")
    return clamp_message("\n".join(lines).rstrip())
