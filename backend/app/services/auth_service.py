import secrets
from datetime import datetime, timedelta, timezone

from app.core.datetime_utils import as_utc, utcnow

from sqlalchemy.orm import Session

from app.core.constants import ActivityType, NotificationType
from app.core.security import (
    create_access_token,
    create_refresh_token,
    get_password_hash,
    verify_password,
)
from app.models import RefreshToken, User
from app.repositories.base import ActivityRepository, NotificationRepository, UserRepository
from app.utils.email import send_notification_email


class AuthService:
    def __init__(self, db: Session):
        self.db = db
        self.user_repo = UserRepository(db)

    def login(self, email: str, password: str) -> dict | None:
        user = self.user_repo.get_by_email(email)
        if not user or not verify_password(password, user.hashed_password):
            return None
        if user.status == "inactive":
            return None

        user.last_login = datetime.now(timezone.utc)
        self.db.commit()

        access_token = create_access_token({"sub": user.id})
        refresh_token_str = create_refresh_token({"sub": user.id})

        refresh = RefreshToken(
            token=refresh_token_str,
            user_id=user.id,
            expires_at=datetime.now(timezone.utc) + timedelta(days=7),
        )
        self.db.add(refresh)
        self.db.commit()

        return {
            "access_token": access_token,
            "refresh_token": refresh_token_str,
            "user": user,
        }

    def refresh(self, refresh_token: str) -> dict | None:
        stored = self.db.query(RefreshToken).filter(RefreshToken.token == refresh_token).first()
        if not stored or as_utc(stored.expires_at) < utcnow():
            return None
        user = self.user_repo.get_by_id(stored.user_id)
        if not user or user.status == "inactive":
            return None
        access_token = create_access_token({"sub": user.id})
        return {"access_token": access_token, "user": user}

    def logout(self, refresh_token: str) -> None:
        self.db.query(RefreshToken).filter(RefreshToken.token == refresh_token).delete()
        self.db.commit()


class UserService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = UserRepository(db)

    def create_user(self, data: dict) -> User:
        if self.repo.get_by_email(data["email"]):
            raise ValueError("Email already registered")
        user = User(
            first_name=data["first_name"],
            last_name=data["last_name"],
            email=data["email"],
            hashed_password=get_password_hash(data["password"]),
            role=data.get("role", "employee"),
            status=data.get("status", "active"),
            job_title=data.get("job_title"),
            phone=data.get("phone"),
            manager_id=data.get("manager_id"),
        )
        if dept_ids := data.get("department_ids"):
            from app.models import Department
            depts = self.db.query(Department).filter(Department.id.in_(dept_ids)).all()
            user.departments = depts
        return self.repo.create(user)

    def update_user(self, user: User, data: dict) -> User:
        if "password" in data and data["password"]:
            user.hashed_password = get_password_hash(data["password"])
            del data["password"]
        if "department_ids" in data and data["department_ids"] is not None:
            from app.models import Department
            depts = self.db.query(Department).filter(Department.id.in_(data["department_ids"])).all()
            user.departments = depts
            del data["department_ids"]
        for key, value in data.items():
            if value is not None and hasattr(user, key):
                setattr(user, key, value)
        return self.repo.update(user)


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
    ) -> None:
        from app.models import Notification

        notif = Notification(
            user_id=user_id,
            notification_type=notification_type,
            title=title,
            message=message,
            link=link,
        )
        self.repo.create(notif)

        if send_email:
            user = UserRepository(self.db).get_by_id(user_id)
            if user:
                send_notification_email(user.email, title, message or title, link)

    def notify_assignees(self, task, notification_type: str, title: str, message: str) -> None:
        for assignee in task.assignees:
            self.notify(assignee.user_id, notification_type, title, message, f"/tasks/{task.id}")
