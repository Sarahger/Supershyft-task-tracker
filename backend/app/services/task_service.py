from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.core.constants import ActivityType, NotificationType, TaskStatus
from app.models import (
    Checklist,
    ChecklistItem,
    Department,
    Tag,
    Task,
    TaskAssignee,
    TaskDependency,
    TaskVersion,
    User,
)
from app.repositories.base import ActivityRepository, TaskRepository, user_to_dict
from app.services.auth_service import NotificationService


class TaskService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = TaskRepository(db)
        self.activity = ActivityRepository(db)
        self.notifications = NotificationService(db)

    def create_task(self, data: dict, creator: User) -> Task:
        task = Task(
            title=data["title"],
            description=data.get("description"),
            task_type_id=data.get("task_type_id"),
            priority=data.get("priority", "medium"),
            status=data.get("status", "unassigned"),
            severity=data.get("severity"),
            estimated_hours=data.get("estimated_hours"),
            actual_hours=data.get("actual_hours"),
            start_date=data.get("start_date"),
            due_date=data.get("due_date"),
            project_id=data.get("project_id"),
            client_id=data.get("client_id"),
            sprint_id=data.get("sprint_id"),
            milestone_id=data.get("milestone_id"),
            reviewer_id=data.get("reviewer_id"),
            review_required=data.get("review_required", False),
            testing_required=data.get("testing_required", False),
            created_by_id=creator.id,
        )

        if assignee_ids := data.get("assignee_ids"):
            for uid in assignee_ids:
                task.assignees.append(TaskAssignee(user_id=uid))
            if task.status == "unassigned":
                task.status = TaskStatus.BACKLOG.value

        if dept_ids := data.get("department_ids"):
            depts = self.db.query(Department).filter(Department.id.in_(dept_ids)).all()
            task.departments = depts

        if tag_ids := data.get("tag_ids"):
            tags = self.db.query(Tag).filter(Tag.id.in_(tag_ids)).all()
            task.tags = tags

        task = self.repo.create(task)
        self.activity.log(creator.id, ActivityType.TASK_CREATED.value, f"Created task: {task.title}", task.id)

        if task.assignees:
            self.notifications.notify_assignees(
                task,
                NotificationType.TASK_ASSIGNED.value,
                f"Assigned to: {task.title}",
                f"You have been assigned to task '{task.title}'",
            )

        return self.repo.get_by_id(task.id)

    def update_task(self, task: Task, data: dict, updater: User) -> Task:
        if "assignee_ids" in data and data["assignee_ids"] is not None:
            existing = {a.user_id for a in task.assignees}
            new_ids = set(data["assignee_ids"])
            for uid in new_ids - existing:
                task.assignees.append(TaskAssignee(user_id=uid))
                self.activity.log(updater.id, ActivityType.ASSIGNEE_ADDED.value, f"Added assignee", task.id)
            task.assignees = [a for a in task.assignees if a.user_id in new_ids]
            del data["assignee_ids"]

        if "department_ids" in data and data["department_ids"] is not None:
            depts = self.db.query(Department).filter(Department.id.in_(data["department_ids"])).all()
            task.departments = depts
            del data["department_ids"]

        if "tag_ids" in data and data["tag_ids"] is not None:
            tags = self.db.query(Tag).filter(Tag.id.in_(data["tag_ids"])).all()
            task.tags = tags
            del data["tag_ids"]

        for key, value in data.items():
            if hasattr(task, key):
                setattr(task, key, value)

        task.updated_by_id = updater.id
        task = self.repo.update(task)
        self.activity.log(updater.id, ActivityType.TASK_UPDATED.value, f"Updated task: {task.title}", task.id)
        return self.repo.get_by_id(task.id)

    def change_status(self, task: Task, new_status: str, user: User, **kwargs) -> Task:
        old_status = task.status

        if new_status == TaskStatus.BLOCKED.value:
            task.previous_status = old_status
            task.block_reason = kwargs.get("block_reason", "")
            task.blocked_by_id = user.id
            task.blocked_at = datetime.now(timezone.utc)
            task.status = new_status
            self.notifications.notify_assignees(
                task, NotificationType.TASK_BLOCKED.value, f"Task blocked: {task.title}", task.block_reason
            )
        elif old_status == TaskStatus.BLOCKED.value and new_status == "unblock":
            task.status = task.previous_status or TaskStatus.IN_PROGRESS.value
            task.previous_status = None
            task.block_reason = None
            task.blocked_by_id = None
            task.blocked_at = None
            self.notifications.notify_assignees(
                task, NotificationType.TASK_UNBLOCKED.value, f"Task unblocked: {task.title}", ""
            )
        elif new_status == TaskStatus.BUGS_FOUND.value:
            task.bug_notes = kwargs.get("bug_notes", "")
            task.bug_reported_by_id = user.id
            task.bug_reported_at = datetime.now(timezone.utc)
            task.status = TaskStatus.IN_PROGRESS.value
            self.activity.log(user.id, ActivityType.BUG_REPORTED.value, f"Bugs found: {task.bug_notes}", task.id)
        else:
            task.status = new_status

        if new_status == TaskStatus.COMPLETED.value:
            task.completed_at = datetime.now(timezone.utc)
            self.notifications.notify_assignees(
                task, NotificationType.TASK_COMPLETED.value, f"Task completed: {task.title}", ""
            )

        task.updated_by_id = user.id
        task = self.repo.update(task)
        self.activity.log(
            user.id,
            ActivityType.STATUS_CHANGED.value,
            f"Status changed from {old_status} to {task.status}",
            task.id,
            metadata={"old_status": old_status, "new_status": task.status},
        )
        return self.repo.get_by_id(task.id)

    def mark_assignee_complete(self, task: Task, user_id: int, is_completed: bool) -> Task:
        assignee = next((a for a in task.assignees if a.user_id == user_id), None)
        if not assignee:
            raise ValueError("User is not an assignee")
        assignee.is_completed = is_completed
        assignee.completed_at = datetime.now(timezone.utc) if is_completed else None
        self.db.commit()

        if task.review_required and all(a.is_completed for a in task.assignees):
            if task.status == TaskStatus.IN_PROGRESS.value:
                task.status = TaskStatus.READY_FOR_REVIEW.value
                self.repo.update(task)
                if task.reviewer_id:
                    self.notifications.notify(
                        task.reviewer_id,
                        NotificationType.REVIEW_REQUESTED.value,
                        f"Review requested: {task.title}",
                        f"Task '{task.title}' is ready for review",
                        f"/tasks/{task.id}",
                    )

        return self.repo.get_by_id(task.id)

    def submit_for_review(self, task: Task, user: User) -> Task:
        if not all(a.is_completed for a in task.assignees):
            raise ValueError("All assignees must complete their work first")
        if not task.reviewer_id:
            raise ValueError("No reviewer assigned")
        if user.id in [a.user_id for a in task.assignees]:
            pass  # assignees can submit

        version = TaskVersion(
            task_id=task.id,
            version_number=task.current_version,
            submission_notes="",
            reviewer_id=task.reviewer_id,
            created_by_id=user.id,
        )
        self.db.add(version)
        task.status = TaskStatus.IN_REVIEW.value
        task = self.repo.update(task)

        self.notifications.notify(
            task.reviewer_id,
            NotificationType.REVIEW_REQUESTED.value,
            f"Review requested: {task.title}",
            f"Task '{task.title}' is ready for your review",
            f"/tasks/{task.id}",
        )
        return self.repo.get_by_id(task.id)

    def review_task(self, task: Task, reviewer: User, action: str, comments: str | None = None) -> Task:
        if task.reviewer_id != reviewer.id:
            raise ValueError("Only the assigned reviewer can review this task")
        if reviewer.id in [a.user_id for a in task.assignees]:
            raise ValueError("Reviewer cannot be an assignee")

        version = (
            self.db.query(TaskVersion)
            .filter(TaskVersion.task_id == task.id, TaskVersion.version_number == task.current_version)
            .first()
        )

        if action == "approve":
            if version:
                version.review_result = "approved"
                version.review_comments = comments
                version.is_locked = True
            task.status = TaskStatus.TESTING.value if task.testing_required else TaskStatus.COMPLETED.value
            if task.status == TaskStatus.COMPLETED.value:
                task.completed_at = datetime.now(timezone.utc)
            self.notifications.notify_assignees(
                task, NotificationType.REVIEW_APPROVED.value, f"Review approved: {task.title}", comments or ""
            )
            self.activity.log(reviewer.id, ActivityType.REVIEW_APPROVED.value, "Review approved", task.id)
        elif action == "request_changes":
            if version:
                version.review_result = "changes_requested"
                version.review_comments = comments
                version.is_locked = True
            task.current_version += 1
            for a in task.assignees:
                a.is_completed = False
                a.completed_at = None
            task.status = TaskStatus.IN_PROGRESS.value
            self.notifications.notify_assignees(
                task, NotificationType.CHANGES_REQUESTED.value, f"Changes requested: {task.title}", comments or ""
            )
            self.activity.log(reviewer.id, ActivityType.CHANGES_REQUESTED.value, f"Changes requested: {comments}", task.id)
        else:
            raise ValueError("Invalid review action")

        task = self.repo.update(task)
        return self.repo.get_by_id(task.id)

    def reopen_task(self, task: Task, user: User) -> Task:
        task.current_version += 1
        task.status = TaskStatus.IN_PROGRESS.value
        task.completed_at = None
        for a in task.assignees:
            a.is_completed = False
            a.completed_at = None
        task = self.repo.update(task)
        self.activity.log(user.id, ActivityType.TASK_REOPENED.value, "Task reopened", task.id)
        self.notifications.notify_assignees(
            task, NotificationType.TASK_REOPENED.value, f"Task reopened: {task.title}", ""
        )
        return self.repo.get_by_id(task.id)

    def add_dependency(self, task: Task, depends_on_id: int, depends_on_user_id: int | None = None) -> TaskDependency:
        if task.id == depends_on_id:
            raise ValueError("Task cannot depend on itself")
        if not self.repo.get_by_id(depends_on_id):
            raise ValueError("Dependency task not found")
        existing = (
            self.db.query(TaskDependency)
            .filter(TaskDependency.task_id == task.id, TaskDependency.depends_on_id == depends_on_id)
            .first()
        )
        if existing:
            raise ValueError("Dependency already exists")
        dep = TaskDependency(
            task_id=task.id,
            depends_on_id=depends_on_id,
            depends_on_user_id=depends_on_user_id,
        )
        self.db.add(dep)
        self.db.commit()
        self.db.refresh(dep)
        return dep

    def remove_dependency(self, task: Task, dependency_id: int) -> None:
        dep = (
            self.db.query(TaskDependency)
            .filter(TaskDependency.id == dependency_id, TaskDependency.task_id == task.id)
            .first()
        )
        if not dep:
            raise ValueError("Dependency not found")
        self.db.delete(dep)
        self.db.commit()

    def task_to_list_dict(self, task: Task) -> dict:
        checklist_total = sum(len(c.items) for c in task.checklists) if task.checklists else 0
        checklist_done = sum(sum(1 for i in c.items if i.is_completed) for c in task.checklists) if task.checklists else 0
        return {
            "id": task.id,
            "title": task.title,
            "status": task.status,
            "priority": task.priority,
            "due_date": task.due_date,
            "project_id": task.project_id,
            "project_name": task.project.name if task.project else None,
            "review_required": task.review_required,
            "testing_required": task.testing_required,
            "assignees": [
                {
                    "id": a.id,
                    "user_id": a.user_id,
                    "is_completed": a.is_completed,
                    "user": user_to_dict(a.user),
                }
                for a in task.assignees
            ],
            "tags": [{"id": t.id, "name": t.name, "color": t.color} for t in task.tags],
            "task_type": {"id": task.task_type.id, "name": task.task_type.name} if task.task_type else None,
            "comment_count": len(task.comments) if hasattr(task, "comments") and task.comments else 0,
            "attachment_count": len(task.attachments) if task.attachments else 0,
            "checklist_progress": f"{checklist_done}/{checklist_total}" if checklist_total else None,
            "estimated_hours": task.estimated_hours,
            "actual_hours": task.actual_hours,
            "is_blocked": task.status == "blocked",
            "created_at": task.created_at,
            "updated_at": task.updated_at,
        }

    def task_to_detail_dict(self, task: Task) -> dict:
        base = self.task_to_list_dict(task)
        base.update({
            "description": task.description,
            "task_type_id": task.task_type_id,
            "severity": task.severity,
            "estimated_hours": task.estimated_hours,
            "actual_hours": task.actual_hours,
            "start_date": task.start_date,
            "client_id": task.client_id,
            "sprint_id": task.sprint_id,
            "milestone_id": task.milestone_id,
            "reviewer_id": task.reviewer_id,
            "previous_status": task.previous_status,
            "block_reason": task.block_reason,
            "blocked_at": task.blocked_at,
            "bug_notes": task.bug_notes,
            "current_version": task.current_version,
            "is_archived": task.is_archived,
            "created_by_id": task.created_by_id,
            "updated_by_id": task.updated_by_id,
            "completed_at": task.completed_at,
            "assignees": [
                {
                    "id": a.id,
                    "user_id": a.user_id,
                    "is_completed": a.is_completed,
                    "completed_at": a.completed_at,
                    "user": user_to_dict(a.user),
                }
                for a in task.assignees
            ],
            "departments": [{"id": d.id, "name": d.name} for d in task.departments],
            "task_type": {"id": task.task_type.id, "name": task.task_type.name} if task.task_type else None,
            "project": {"id": task.project.id, "name": task.project.name} if task.project else None,
            "client": {"id": task.client.id, "name": task.client.name} if task.client else None,
            "reviewer": user_to_dict(task.reviewer),
            "creator": user_to_dict(task.creator),
            "checklists": [
                {
                    "id": c.id,
                    "title": c.title,
                    "items": [{"id": i.id, "title": i.title, "is_completed": i.is_completed, "sort_order": i.sort_order} for i in c.items],
                }
                for c in task.checklists
            ],
            "dependencies": [
                {
                    "id": d.id,
                    "depends_on_id": d.depends_on_id,
                    "depends_on_title": d.depends_on.title if d.depends_on else None,
                    "depends_on_user_id": d.depends_on_user_id,
                    "depends_on_user": user_to_dict(d.depends_on_user) if d.depends_on_user else None,
                }
                for d in task.dependencies
            ] if hasattr(task, "dependencies") else [],
            "custom_field_values": {
                v.field_definition.field_key: v.value
                for v in (task.custom_field_values or [])
                if v.field_definition
            },
            "attachments": [
                {
                    "id": a.id,
                    "filename": a.filename,
                    "file_size": a.file_size,
                    "mime_type": a.mime_type,
                    "attachment_type": a.attachment_type,
                    "created_at": a.created_at,
                    "uploaded_by": user_to_dict(a.uploader),
                }
                for a in (task.attachments or [])
            ],
        })
        return base
