from datetime import datetime, timedelta, timezone

from app.core.datetime_utils import as_utc, utcnow

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session, joinedload

from app.core.dependencies import get_current_user
from app.db.database import get_db
from app.models import ActivityLog, Project, Task, User
from app.repositories.base import NotificationRepository, TaskRepository
from app.schemas.common import APIResponse
from app.schemas.misc import NotificationPreferencesUpdate, ReportFilter
from app.services.notification_service import NotificationService, notification_preferences_dict

router = APIRouter(tags=["dashboard"])


@router.get("/notifications")
def get_notifications(
    unread_only: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    notifs = NotificationRepository(db).get_for_user(current_user.id, unread_only)
    return APIResponse(
        data=[
            {
                "id": n.id,
                "notification_type": n.notification_type,
                "title": n.title,
                "message": n.message,
                "link": n.link,
                "is_read": n.is_read,
                "email_sent": n.email_sent,
                "created_at": n.created_at,
            }
            for n in notifs
        ]
    )


@router.patch("/notifications/{notification_id}/read")
def mark_notification_read(
    notification_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    NotificationRepository(db).mark_read(notification_id, current_user.id)
    return APIResponse(message="Marked as read")


@router.patch("/notifications/read-all")
def mark_all_read(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    NotificationRepository(db).mark_all_read(current_user.id)
    return APIResponse(message="All marked as read")


@router.get("/notifications/preferences")
def get_notification_preferences(current_user: User = Depends(get_current_user)):
    return APIResponse(data=notification_preferences_dict(current_user))


@router.patch("/notifications/preferences")
def update_notification_preferences(
    data: NotificationPreferencesUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    user = NotificationService(db).update_preferences(
        current_user,
        data.model_dump(exclude_unset=True),
    )
    return APIResponse(data=notification_preferences_dict(user), message="Preferences updated")


@router.post("/notifications/test-email")
def send_test_notification_email(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sent = NotificationService(db).send_test_email(current_user)
    if not sent:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Email is disabled or SMTP is not configured on the server",
        )
    return APIResponse(message="Test email sent")


@router.get("/dashboard")
def get_dashboard(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    repo = TaskRepository(db)
    now = datetime.now(timezone.utc)
    week_end = now + timedelta(days=7)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    from app.models import TaskAssignee

    my_tasks_query = (
        db.query(Task)
        .join(TaskAssignee)
        .filter(TaskAssignee.user_id == current_user.id, Task.is_archived == False)
    )

    open_tasks = my_tasks_query.filter(Task.status.notin_(["completed", "cancelled"])).count()
    completed_tasks = my_tasks_query.filter(Task.status == "completed").count()
    blocked_tasks = repo.count_by_status("blocked")
    overdue_tasks = (
        db.query(Task)
        .join(TaskAssignee)
        .filter(
            TaskAssignee.user_id == current_user.id,
            Task.due_date < now,
            Task.status.notin_(["completed", "cancelled"]),
        )
        .count()
    )
    pending_reviews = db.query(Task).filter(Task.reviewer_id == current_user.id, Task.status == "in_review").count()

    my_tasks_today = (
        my_tasks_query.filter(Task.due_date >= today_start, Task.due_date < today_start + timedelta(days=1))
        .filter(Task.status.notin_(["completed", "cancelled"]))
        .count()
    )
    my_tasks_week = (
        my_tasks_query.filter(Task.due_date >= now, Task.due_date <= week_end)
        .filter(Task.status.notin_(["completed", "cancelled"]))
        .count()
    )

    recent_activity = (
        db.query(ActivityLog)
        .order_by(ActivityLog.created_at.desc())
        .limit(20)
        .all()
    )

    pending_review_tasks = (
        db.query(Task)
        .filter(Task.reviewer_id == current_user.id, Task.status.in_(["ready_for_review", "in_review"]))
        .limit(10)
        .all()
    )

    recent_tasks = my_tasks_query.order_by(Task.updated_at.desc()).limit(10).all()

    projects = db.query(Project).filter(Project.is_archived == False).limit(6).all()

    status_distribution = {}
    for status in ["to_do", "in_progress", "blocked", "in_review", "completed"]:
        status_distribution[status] = db.query(Task).filter(Task.status == status, Task.is_archived == False).count()

    priority_distribution = {}
    for p in ["low", "medium", "high", "critical"]:
        priority_distribution[p] = db.query(Task).filter(Task.priority == p, Task.is_archived == False).count()

    from app.services.task_service import TaskService
    service = TaskService(db)

    return APIResponse(
        data={
            "stats": {
                "open_tasks": open_tasks,
                "completed_tasks": completed_tasks,
                "blocked_tasks": blocked_tasks,
                "overdue_tasks": overdue_tasks,
                "pending_reviews": pending_reviews,
                "my_tasks_today": my_tasks_today,
                "my_tasks_week": my_tasks_week,
            },
            "recent_tasks": [service.task_to_list_dict(t) for t in recent_tasks],
            "pending_reviews": [service.task_to_list_dict(t) for t in pending_review_tasks],
            "recent_activity": [
                {
                    "id": a.id,
                    "activity_type": a.activity_type,
                    "description": a.description,
                    "created_at": a.created_at,
                    "user": {"id": a.user_id, "name": a.user.full_name if a.user else "Unknown"},
                }
                for a in recent_activity
            ],
            "projects": [
                {
                    "id": p.id,
                    "name": p.name,
                    "health": p.health,
                    "status": p.status,
                }
                for p in projects
            ],
            "status_distribution": status_distribution,
            "priority_distribution": priority_distribution,
            "role": current_user.role,
        }
    )


@router.post("/reports/tasks")
def task_report(filters: ReportFilter, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    from app.models import TaskAssignee, task_departments

    if current_user.role == "employee":
        filters = filters.model_copy(update={"user_id": current_user.id})

    query = (
        db.query(Task)
        .options(
            joinedload(Task.assignees).joinedload(TaskAssignee.user).joinedload(User.departments),
        )
        .filter(Task.is_archived == False)
    )
    if filters.project_id:
        query = query.filter(Task.project_id == filters.project_id)
    if filters.start_date:
        query = query.filter(Task.created_at >= filters.start_date)
    if filters.end_date:
        query = query.filter(Task.created_at <= filters.end_date)
    if filters.department_id:
        query = query.join(task_departments).filter(task_departments.c.department_id == filters.department_id)
    if filters.user_id:
        query = query.join(TaskAssignee).filter(TaskAssignee.user_id == filters.user_id)

    tasks = query.all()
    now = utcnow()
    week_end = now + timedelta(days=7)

    pending_statuses = {"completed", "cancelled"}
    by_assignee: dict[int, dict] = {}
    unassigned_pending = 0

    for task in tasks:
        is_pending = task.status not in pending_statuses
        is_overdue = bool(
            task.due_date and as_utc(task.due_date) < now and is_pending
        )
        is_blocked = task.status == "blocked"
        is_in_progress = task.status == "in_progress"
        is_completed = task.status == "completed"
        due_this_week = bool(
            task.due_date
            and is_pending
            and now <= as_utc(task.due_date) <= week_end
        )

        if not task.assignees:
            if is_pending:
                unassigned_pending += 1
            continue

        for assignee in task.assignees:
            uid = assignee.user_id
            user = assignee.user
            if uid not in by_assignee:
                by_assignee[uid] = {
                    "user_id": uid,
                    "name": f"{user.first_name} {user.last_name}" if user else "Unknown",
                    "departments": [d.name for d in (user.departments or [])] if user else [],
                    "pending": 0,
                    "in_progress": 0,
                    "overdue": 0,
                    "blocked": 0,
                    "completed": 0,
                    "due_this_week": 0,
                    "total_assigned": 0,
                }
            stats = by_assignee[uid]
            stats["total_assigned"] += 1
            if is_pending:
                stats["pending"] += 1
            if is_in_progress:
                stats["in_progress"] += 1
            if is_overdue:
                stats["overdue"] += 1
            if is_blocked:
                stats["blocked"] += 1
            if is_completed:
                stats["completed"] += 1
            if due_this_week:
                stats["due_this_week"] += 1

    assignee_list = sorted(by_assignee.values(), key=lambda x: (-x["pending"], x["name"]))
    pending_total = len([t for t in tasks if t.status not in pending_statuses])
    completed = len([t for t in tasks if t.status == "completed"])
    overdue = len([
        t for t in tasks
        if t.due_date and as_utc(t.due_date) < now and t.status not in pending_statuses
    ])
    blocked = len([t for t in tasks if t.status == "blocked"])
    in_progress = len([t for t in tasks if t.status == "in_progress"])

    return APIResponse(
        data={
            "total": len(tasks),
            "pending": pending_total,
            "by_status": _count_by_field(tasks, "status"),
            "by_priority": _count_by_field(tasks, "priority"),
            "completed": completed,
            "overdue": overdue,
            "blocked": blocked,
            "in_progress": in_progress,
            "unassigned_pending": unassigned_pending,
            "by_assignee": assignee_list,
            "people_with_overdue": len([p for p in assignee_list if p["overdue"] > 0]),
        }
    )


@router.post("/reports/export/csv")
def export_csv(filters: ReportFilter, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    import csv
    import io

    from app.models import TaskAssignee

    query = (
        db.query(Task)
        .options(joinedload(Task.assignees).joinedload(TaskAssignee.user))
        .filter(Task.is_archived == False)
    )
    if filters.project_id:
        query = query.filter(Task.project_id == filters.project_id)
    if filters.user_id:
        from app.models import TaskAssignee
        query = query.join(TaskAssignee).filter(TaskAssignee.user_id == filters.user_id)
    tasks = query.all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["ID", "Title", "Status", "Priority", "Due Date", "Assignees", "Created At"])
    for t in tasks:
        assignee_names = ", ".join(
            f"{a.user.first_name} {a.user.last_name}" for a in (t.assignees or []) if a.user
        )
        writer.writerow([t.id, t.title, t.status, t.priority, t.due_date, assignee_names, t.created_at])
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=tasks_report.csv"},
    )


def _count_by_field(items, field: str) -> dict:
    result = {}
    for item in items:
        val = getattr(item, field)
        result[val] = result.get(val, 0) + 1
    return result
