"""Load local demo weekly updates so the Weekly Updates page has something to review.

Idempotent: replaces only rows marked as local demo. Does not delete real reports.
"""

from __future__ import annotations

from datetime import date, datetime, time, timedelta, timezone

from app.db.database import SessionLocal
from app.models import (
    Task,
    TaskAssignee,
    User,
    WeeklyReport,
    WeeklyReportCommitment,
    WeeklyReportCompletion,
)
from app.utils.week_periods import due_at_noon, monday_of, planning_window

DEMO_NOTE = "Local demo data"


SAMPLES = [
    {
        "names": ("harsh",),
        "done": [
            "Server updates",
            "Diwali website animation",
            "PDF automation for Diwali website",
            "Allergy pages completed on Bio-AI reports",
        ],
        "plan": [
            ("New updated API integration in CBTW, Celebal and Nvidia 1+1 form", 4, 4),
            ("Cancer pages on Bio-AI report", 15, 5),
            ("Flutter screens (Cancer, allergy, super care, rating/feedback, consent)", 7.5, 6),
        ],
    },
    {
        "names": ("nigel",),
        "done": [
            "Custom Packages final design implementation till the end",
            "B2B form fix if user leaves unexpectedly he should land on same page",
            "API integration of Custom Packages screens",
            "Map the Packages with the All Appointments page on My Profile",
            "Changes of design as per Harshili",
        ],
        "plan": [
            ("Custom Packages on Flutter", 15, 4),
            ("Change icons of Navbar", 1, 2),
            ("AWS final integration", 3, 3),
            ("Forms — WLDD / Monk e", 7.5, 5),
            ("Old users' data — Monk e, WLDD and Force One camp", 7.5, 6),
        ],
    },
    {
        "names": ("pratheek", "prathik"),
        "done": [
            "Diwali Package Booking APIs — gift package, notifications",
            "Engagements update — auto booking flag and payment method",
            "Updated freeze slot and booking step in one API",
            "New API: my appointments",
            "Added cancer and allergy flags in diagnostic package",
            "Merged blogs",
            "Revalidated tests of all packages",
            "WhatsApp restructuring (staging)",
            "Meet with WhatsApp team on doc template names",
        ],
        "plan": [
            ("Custom Packages — profile_id, deal_id, booking", 18.75, 5),
            ("Prevent repeat packages across multiple partners", 3, 3),
            ("Cancer allergy testing of PDF with Yukti", 15, 6),
            ("Redcliffe serviceability API integration", 6, 4),
            ("Admin panel changes — diagnostic page", 0.75, 2),
        ],
    },
]


def _users_for_demo(db) -> list[User]:
    active = (
        db.query(User)
        .filter(User.status != "inactive")
        .order_by(User.first_name, User.last_name)
        .all()
    )
    picked: list[User] = []
    used: set[int] = set()
    for sample in SAMPLES:
        match = next(
            (u for u in active if u.first_name.lower() in sample["names"] and u.id not in used),
            None,
        )
        if match:
            picked.append(match)
            used.add(match.id)
    for user in active:
        if len(picked) >= 3:
            break
        if user.id not in used:
            picked.append(user)
            used.add(user.id)
    return picked[:3]


def _clear_demo(db) -> None:
    reports = db.query(WeeklyReport).filter(WeeklyReport.leave_notes == DEMO_NOTE).all()
    task_ids = set()
    for report in reports:
        for row in report.commitments:
            if row.task_id:
                task_ids.add(row.task_id)
        for row in report.completions:
            if row.task_id:
                task_ids.add(row.task_id)
        db.delete(report)
    if task_ids:
        db.query(Task).filter(Task.id.in_(task_ids), Task.title.like("[Demo]%")).delete(
            synchronize_session=False
        )
    db.flush()


def seed_weekly_demo() -> list[str]:
    db = SessionLocal()
    created: list[str] = []
    try:
        users = _users_for_demo(db)
        if not users:
            return ["No users found. Sign in or seed the database first."]

        _clear_demo(db)

        today = date.today()
        this_monday = monday_of(today)
        last_monday = this_monday - timedelta(days=7)
        last_friday = last_monday + timedelta(days=4)
        last_plan_start, last_plan_end = planning_window(last_monday)
        this_plan_start, this_plan_end = planning_window(this_monday)
        now = datetime.now(timezone.utc)
        adopted = datetime.combine(last_monday - timedelta(days=14), time.min, tzinfo=timezone.utc)

        for index, user in enumerate(users):
            sample = SAMPLES[index]
            if user.weekly_updates_adopted_at is None:
                user.weekly_updates_adopted_at = adopted

            done_tasks: list[Task] = []
            for title in sample["done"]:
                task = Task(
                    title=f"[Demo] {title}",
                    description="Local demo task for Weekly Updates",
                    priority="medium",
                    status="completed",
                    estimated_hours=4,
                    created_by_id=user.id,
                    completed_at=datetime.combine(last_friday, time(16, 0), tzinfo=timezone.utc),
                    due_date=due_at_noon(last_friday),
                    original_due_date=due_at_noon(last_friday),
                )
                task.assignees.append(TaskAssignee(user_id=user.id, is_completed=True, completed_at=task.completed_at))
                db.add(task)
                done_tasks.append(task)
            db.flush()

            last_report = WeeklyReport(
                user_id=user.id,
                period_start=last_monday,
                period_end=last_friday,
                planning_start=last_plan_start,
                planning_end=last_plan_end,
                status="submitted",
                submitted_at=datetime.combine(last_friday, time(18, 0), tzinfo=timezone.utc),
                leave_notes=DEMO_NOTE,
            )
            db.add(last_report)
            db.flush()
            for task in done_tasks:
                last_report.completions.append(
                    WeeklyReportCompletion(
                        task_id=task.id,
                        title=task.title.replace("[Demo] ", "", 1),
                        completion_date=last_friday,
                        source="suggested",
                        included=True,
                    )
                )

            plan_tasks: list[tuple[Task, float, date]] = []
            for title, hours, offset_days in sample["plan"]:
                due = this_plan_start + timedelta(days=min(offset_days, 6))
                task = Task(
                    title=f"[Demo] {title}",
                    description="Local demo commitment for Weekly Updates",
                    priority="medium",
                    status="in_progress" if offset_days <= 3 else "to_do",
                    estimated_hours=hours,
                    created_by_id=user.id,
                    due_date=due_at_noon(due),
                    original_due_date=due_at_noon(due),
                )
                task.assignees.append(TaskAssignee(user_id=user.id))
                db.add(task)
                plan_tasks.append((task, hours, due))
            db.flush()

            for task, hours, due in plan_tasks:
                last_report.commitments.append(
                    WeeklyReportCommitment(
                        task_id=task.id,
                        title=task.title.replace("[Demo] ", "", 1),
                        estimated_hours=hours,
                        due_date=due_at_noon(due),
                        original_due_date=due_at_noon(due),
                        commitment_type="new",
                    )
                )

            if index == 0:
                this_end = min(today, this_monday + timedelta(days=5))
                current = WeeklyReport(
                    user_id=user.id,
                    period_start=this_monday,
                    period_end=this_end,
                    planning_start=this_plan_start,
                    planning_end=this_plan_end,
                    status="submitted",
                    submitted_at=now,
                    leave_notes=DEMO_NOTE,
                )
                db.add(current)
                db.flush()
                if done_tasks:
                    current.completions.append(
                        WeeklyReportCompletion(
                            task_id=None,
                            title="Follow-up polish on last week's Diwali work",
                            completion_date=today,
                            source="manual",
                            included=True,
                        )
                    )
                for task, hours, due in plan_tasks[:2]:
                    current.commitments.append(
                        WeeklyReportCommitment(
                            task_id=task.id,
                            title=task.title.replace("[Demo] ", "", 1),
                            estimated_hours=hours,
                            due_date=task.due_date,
                            original_due_date=task.original_due_date,
                            commitment_type="carried_forward",
                        )
                    )

            created.append(f"{user.first_name} {user.last_name}")

        db.commit()
        return created
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    names = seed_weekly_demo()
    print("Weekly demo data loaded for:", ", ".join(names) if names else "nobody")
