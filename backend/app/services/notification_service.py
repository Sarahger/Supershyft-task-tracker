import logging

from sqlalchemy.orm import Session

from app.core.constants import NotificationType
from app.models import Notification, User
from app.repositories.base import NotificationRepository, UserRepository
from app.utils.email import send_notification_email

logger = logging.getLogger(__name__)

ASSIGNMENT_TYPES = {
    NotificationType.TASK_ASSIGNED.value,
    NotificationType.TASK_REASSIGNED.value,
}

UPDATE_TYPES = {
    NotificationType.TASK_BLOCKED.value,
    NotificationType.TASK_UNBLOCKED.value,
    NotificationType.TASK_COMPLETED.value,
    NotificationType.TASK_REOPENED.value,
    NotificationType.OVERDUE_TASK.value,
    NotificationType.DEPENDENCY_UPDATED.value,
    NotificationType.PROJECT_UPDATE.value,
}

REVIEW_TYPES = {
    NotificationType.REVIEWER_ASSIGNED.value,
    NotificationType.REVIEW_REQUESTED.value,
    NotificationType.REVIEW_APPROVED.value,
    NotificationType.CHANGES_REQUESTED.value,
}

COMMENT_TYPES = {
    NotificationType.TASK_COMMENT.value,
    NotificationType.COMMENT_REPLY.value,
    NotificationType.MENTION.value,
}

MEETING_TYPES = {
    NotificationType.TASK_CALL.value,
}


def notification_preferences_dict(user: User) -> dict:
    return {
        "email_notifications_enabled": user.email_notifications_enabled,
        "notify_task_assigned": user.notify_task_assigned,
        "notify_task_updates": user.notify_task_updates,
        "notify_reviews": user.notify_reviews,
        "notify_comments": user.notify_comments,
        "notify_meetings": user.notify_meetings,
    }


def should_send_email(user: User, notification_type: str) -> bool:
    if user.status == "inactive" or not user.email_notifications_enabled:
        return False
    if notification_type in ASSIGNMENT_TYPES:
        return user.notify_task_assigned
    if notification_type in UPDATE_TYPES:
        return user.notify_task_updates
    if notification_type in REVIEW_TYPES:
        return user.notify_reviews
    if notification_type in COMMENT_TYPES:
        return user.notify_comments
    if notification_type in MEETING_TYPES:
        return user.notify_meetings
    return True


class NotificationService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = NotificationRepository(db)

    def notify(
        self,
        user_id: int,
        notification_type: str,
        title: str,
        message: str | None = None,
        link: str | None = None,
        send_email: bool = True,
    ) -> Notification:
        notif = Notification(
            user_id=user_id,
            notification_type=notification_type,
            title=title,
            message=message,
            link=link,
        )
        notif = self.repo.create(notif)

        if send_email:
            user = UserRepository(self.db).get_by_id(user_id)
            if user and should_send_email(user, notification_type):
                sent = send_notification_email(user.email, title, message or title, link)
                if sent:
                    notif.email_sent = True
                    self.db.commit()
                    self.db.refresh(notif)

        return notif

    def notify_assignees(
        self,
        task,
        notification_type: str,
        title: str,
        message: str,
        exclude_user_id: int | None = None,
    ) -> None:
        for assignee in task.assignees:
            if exclude_user_id and assignee.user_id == exclude_user_id:
                continue
            self.notify(assignee.user_id, notification_type, title, message, f"/tasks/{task.id}")

    def notify_task_watchers(
        self,
        task,
        notification_type: str,
        title: str,
        message: str,
        exclude_user_id: int | None = None,
        also_exclude_user_ids: set[int] | None = None,
    ) -> None:
        recipient_ids: set[int] = {a.user_id for a in task.assignees}
        if task.reviewer_id:
            recipient_ids.add(task.reviewer_id)
        if exclude_user_id:
            recipient_ids.discard(exclude_user_id)
        if also_exclude_user_ids:
            recipient_ids -= also_exclude_user_ids
        for user_id in recipient_ids:
            self.notify(user_id, notification_type, title, message, f"/tasks/{task.id}")

    def update_preferences(self, user: User, data: dict) -> User:
        for key, value in data.items():
            if value is not None and hasattr(user, key):
                setattr(user, key, value)
        self.db.commit()
        self.db.refresh(user)
        return user

    def send_test_email(self, user: User) -> bool:
        return send_notification_email(
            user.email,
            "Test notification",
            "Email notifications are working. You will receive alerts for task updates based on your preferences.",
            "/settings",
        )
