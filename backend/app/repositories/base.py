import json
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import case, func, or_
from sqlalchemy.orm import Session, joinedload

from app.models import (
    ActivityLog,
    Attachment,
    Checklist,
    ChecklistItem,
    Client,
    Comment,
    Department,
    Notification,
    Project,
    Tag,
    Task,
    TaskAssignee,
    TaskCustomFieldValue,
    TaskDependency,
    TaskType,
    User,
)


def user_to_dict(user: User | None) -> dict | None:
    if not user:
        return None
    return {
        "id": user.id,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "email": user.email,
        "role": user.role,
        "profile_picture": user.profile_picture,
        "job_title": user.job_title,
    }


def user_to_brief_dict(user: User | None) -> dict | None:
    if not user:
        return None
    return {
        "id": user.id,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "profile_picture": user.profile_picture,
    }


class BaseRepository:
    def __init__(self, db: Session):
        self.db = db


class UserRepository(BaseRepository):
    def get_by_id(self, user_id: int) -> User | None:
        return self.db.query(User).options(joinedload(User.departments)).filter(User.id == user_id).first()

    def get_by_email(self, email: str) -> User | None:
        return self.db.query(User).filter(User.email == email).first()

    def get_all(self, skip: int = 0, limit: int = 100, search: str | None = None) -> tuple[list[User], int]:
        query = self.db.query(User).options(joinedload(User.departments))
        if search:
            term = f"%{search}%"
            query = query.filter(
                or_(
                    User.first_name.ilike(term),
                    User.last_name.ilike(term),
                    User.email.ilike(term),
                )
            )
        total = query.count()
        users = query.offset(skip).limit(limit).all()
        return users, total

    def create(self, user: User) -> User:
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return user

    def update(self, user: User) -> User:
        self.db.commit()
        self.db.refresh(user)
        return user


class TaskRepository(BaseRepository):
    def get_by_id(self, task_id: int) -> Task | None:
        return (
            self.db.query(Task)
            .options(
                joinedload(Task.assignees).joinedload(TaskAssignee.user),
                joinedload(Task.departments),
                joinedload(Task.tags),
                joinedload(Task.task_type),
                joinedload(Task.project),
                joinedload(Task.client),
                joinedload(Task.reviewer),
                joinedload(Task.creator),
                joinedload(Task.checklists).joinedload(Checklist.items),
                joinedload(Task.attachments).joinedload(Attachment.uploader),
                joinedload(Task.dependencies).joinedload(TaskDependency.depends_on),
                joinedload(Task.dependencies).joinedload(TaskDependency.depends_on_user),
                joinedload(Task.custom_field_values).joinedload(TaskCustomFieldValue.field_definition),
            )
            .filter(Task.id == task_id, Task.is_archived == False)
            .first()
        )

    def get_filtered(
        self,
        skip: int = 0,
        limit: int = 50,
        filters: dict[str, Any] | None = None,
    ) -> tuple[list[Task], int]:
        query = (
            self.db.query(Task)
            .options(
                joinedload(Task.assignees).joinedload(TaskAssignee.user),
                joinedload(Task.tags),
                joinedload(Task.project),
                joinedload(Task.task_type),
            )
            .filter(Task.is_archived == False)
        )
        filters = filters or {}

        if status := filters.get("status"):
            if isinstance(status, list):
                query = query.filter(Task.status.in_(status))
            else:
                query = query.filter(Task.status == status)
        if priority := filters.get("priority"):
            query = query.filter(Task.priority == priority)
        if project_id := filters.get("project_id"):
            query = query.filter(Task.project_id == project_id)
        if client_id := filters.get("client_id"):
            query = query.filter(Task.client_id == client_id)
        if assignee_id := filters.get("assignee_id"):
            query = query.join(TaskAssignee).filter(TaskAssignee.user_id == assignee_id)
        if reviewer_id := filters.get("reviewer_id"):
            query = query.filter(Task.reviewer_id == reviewer_id)
        if created_by_id := filters.get("created_by_id"):
            query = query.filter(Task.created_by_id == created_by_id)
        if task_type_id := filters.get("task_type_id"):
            query = query.filter(Task.task_type_id == task_type_id)
        if filters.get("overdue"):
            now = datetime.now(timezone.utc)
            query = query.filter(Task.due_date < now, Task.status.notin_(["completed", "cancelled"]))
        if filters.get("blocked"):
            query = query.filter(Task.status == "blocked")
        if filters.get("awaiting_review"):
            query = query.filter(Task.status.in_(["ready_for_review", "in_review"]))
        if filters.get("has_due_date") is True:
            query = query.filter(Task.due_date.isnot(None))
        elif filters.get("has_due_date") is False:
            query = query.filter(Task.due_date.is_(None))
        if due_after := filters.get("due_after"):
            if isinstance(due_after, str):
                due_after = datetime.fromisoformat(due_after.replace("Z", "+00:00"))
            query = query.filter(Task.due_date >= due_after)
        if due_before := filters.get("due_before"):
            if isinstance(due_before, str):
                due_before = datetime.fromisoformat(due_before.replace("Z", "+00:00"))
            query = query.filter(Task.due_date <= due_before)
        if search := filters.get("search"):
            term = f"%{search}%"
            query = query.filter(or_(Task.title.ilike(term), Task.description.ilike(term)))
        if department_id := filters.get("department_id"):
            from app.models import task_departments
            query = query.join(task_departments).filter(task_departments.c.department_id == department_id)

        sort_by = filters.get("sort_by", "updated_at")
        sort_order = filters.get("sort_order", "desc")
        sort_col = getattr(Task, sort_by, Task.updated_at)
        query = query.order_by(sort_col.desc() if sort_order == "desc" else sort_col.asc())

        total = query.count()
        tasks = query.offset(skip).limit(limit).all()
        return tasks, total

    def load_list_stats(self, task_ids: list[int]) -> dict[int, dict]:
        """Batch-load comment, attachment, and checklist counts for list views."""
        if not task_ids:
            return {}

        stats: dict[int, dict] = {task_id: {"comment_count": 0, "attachment_count": 0} for task_id in task_ids}

        for task_id, count in (
            self.db.query(Comment.task_id, func.count(Comment.id))
            .filter(Comment.task_id.in_(task_ids))
            .group_by(Comment.task_id)
            .all()
        ):
            stats[task_id]["comment_count"] = count

        for task_id, count in (
            self.db.query(Attachment.task_id, func.count(Attachment.id))
            .filter(Attachment.task_id.in_(task_ids))
            .group_by(Attachment.task_id)
            .all()
        ):
            if task_id is not None:
                stats[task_id]["attachment_count"] = count

        checklist_rows = (
            self.db.query(
                Checklist.task_id,
                func.count(ChecklistItem.id),
                func.sum(case((ChecklistItem.is_completed.is_(True), 1), else_=0)),
            )
            .join(ChecklistItem, ChecklistItem.checklist_id == Checklist.id)
            .filter(Checklist.task_id.in_(task_ids))
            .group_by(Checklist.task_id)
            .all()
        )
        for task_id, total, done in checklist_rows:
            done_count = int(done or 0)
            total_count = int(total or 0)
            if total_count:
                stats[task_id]["checklist_progress"] = f"{done_count}/{total_count}"

        return stats

    def create(self, task: Task) -> Task:
        self.db.add(task)
        self.db.commit()
        self.db.refresh(task)
        return task

    def update(self, task: Task) -> Task:
        self.db.commit()
        self.db.refresh(task)
        return task

    def count_by_status(self, status: str, user_id: int | None = None) -> int:
        query = self.db.query(Task).filter(Task.status == status, Task.is_archived == False)
        if user_id:
            query = query.join(TaskAssignee).filter(TaskAssignee.user_id == user_id)
        return query.count()


class ProjectRepository(BaseRepository):
    def get_by_id(self, project_id: int) -> Project | None:
        return self.db.query(Project).filter(Project.id == project_id).first()

    def get_all(self, skip: int = 0, limit: int = 100) -> tuple[list[Project], int]:
        query = self.db.query(Project).filter(Project.is_archived == False)
        total = query.count()
        return query.offset(skip).limit(limit).all(), total

    def create(self, project: Project) -> Project:
        self.db.add(project)
        self.db.commit()
        self.db.refresh(project)
        return project

    def update(self, project: Project) -> Project:
        self.db.commit()
        self.db.refresh(project)
        return project


class DepartmentRepository(BaseRepository):
    def get_by_id(self, dept_id: int) -> Department | None:
        return self.db.query(Department).filter(Department.id == dept_id).first()

    def get_all(self) -> list[Department]:
        return self.db.query(Department).all()

    def create(self, dept: Department) -> Department:
        self.db.add(dept)
        self.db.commit()
        self.db.refresh(dept)
        return dept

    def update(self, dept: Department) -> Department:
        self.db.commit()
        self.db.refresh(dept)
        return dept


class ActivityRepository(BaseRepository):
    def log(
        self,
        user_id: int,
        activity_type: str,
        description: str,
        task_id: int | None = None,
        project_id: int | None = None,
        metadata: dict | None = None,
    ) -> ActivityLog:
        log = ActivityLog(
            user_id=user_id,
            activity_type=activity_type,
            description=description,
            task_id=task_id,
            project_id=project_id,
            metadata_json=json.dumps(metadata) if metadata else None,
        )
        self.db.add(log)
        self.db.commit()
        return log

    def get_for_task(self, task_id: int) -> list[ActivityLog]:
        return (
            self.db.query(ActivityLog)
            .options(joinedload(ActivityLog.user))
            .filter(ActivityLog.task_id == task_id)
            .order_by(ActivityLog.created_at.desc())
            .all()
        )


class NotificationRepository(BaseRepository):
    def create(self, notification: Notification) -> Notification:
        self.db.add(notification)
        self.db.commit()
        self.db.refresh(notification)
        return notification

    def get_for_user(self, user_id: int, unread_only: bool = False) -> list[Notification]:
        query = self.db.query(Notification).filter(Notification.user_id == user_id)
        if unread_only:
            query = query.filter(Notification.is_read == False)
        return query.order_by(Notification.created_at.desc()).limit(50).all()

    def mark_read(self, notification_id: int, user_id: int) -> bool:
        notif = (
            self.db.query(Notification)
            .filter(Notification.id == notification_id, Notification.user_id == user_id)
            .first()
        )
        if notif:
            notif.is_read = True
            self.db.commit()
            return True
        return False

    def mark_all_read(self, user_id: int) -> None:
        self.db.query(Notification).filter(
            Notification.user_id == user_id, Notification.is_read == False
        ).update({"is_read": True})
        self.db.commit()


class SearchRepository(BaseRepository):
    def search(self, query_str: str, limit: int = 10) -> dict:
        term = f"%{query_str}%"
        tasks = self.db.query(Task).filter(Task.title.ilike(term), Task.is_archived == False).limit(limit).all()
        projects = self.db.query(Project).filter(Project.name.ilike(term), Project.is_archived == False).limit(limit).all()
        users = (
            self.db.query(User)
            .filter(
                or_(User.first_name.ilike(term), User.last_name.ilike(term), User.email.ilike(term)),
                User.status != "inactive",
            )
            .limit(limit)
            .all()
        )
        clients = self.db.query(Client).filter(Client.name.ilike(term), Client.is_archived == False).limit(limit).all()
        tags = self.db.query(Tag).filter(Tag.name.ilike(term)).limit(limit).all()
        return {"tasks": tasks, "projects": projects, "users": users, "clients": clients, "tags": tags}
