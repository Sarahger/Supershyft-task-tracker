import logging
import random
import secrets
from datetime import datetime, timedelta, timezone

from app.core.datetime_utils import as_utc, utcnow

from sqlalchemy.orm import Session

from app.core.security import (
    create_access_token,
    create_refresh_token,
    get_password_hash,
    verify_password,
)
from app.models import LoginOtp, RefreshToken, User
from app.repositories.base import UserRepository
from app.utils.email import send_otp_email

logger = logging.getLogger(__name__)

OTP_TTL_MINUTES = 10
OTP_MAX_ATTEMPTS = 5
OTP_RATE_LIMIT_SECONDS = 60


class AuthService:
    def __init__(self, db: Session):
        self.db = db
        self.user_repo = UserRepository(db)

    def _issue_tokens(self, user: User) -> dict:
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

    def request_otp(self, email: str) -> None:
        user = self.user_repo.get_by_email(email)
        if not user or user.status == "inactive":
            raise ValueError("No active account found for this email")

        recent = (
            self.db.query(LoginOtp)
            .filter(
                LoginOtp.email == email,
                LoginOtp.created_at >= utcnow() - timedelta(seconds=OTP_RATE_LIMIT_SECONDS),
            )
            .first()
        )
        if recent:
            raise ValueError("Please wait a minute before requesting another code")

        self.db.query(LoginOtp).filter(LoginOtp.email == email).delete()

        code = f"{random.randint(0, 999999):06d}"
        otp = LoginOtp(
            email=email,
            code_hash=get_password_hash(code),
            expires_at=utcnow() + timedelta(minutes=OTP_TTL_MINUTES),
        )
        self.db.add(otp)
        self.db.commit()

        sent = send_otp_email(user.email, code)
        if not sent:
            logger.warning("OTP email not sent. Login code for %s: %s", email, code)

    def verify_otp(self, email: str, code: str) -> dict | None:
        user = self.user_repo.get_by_email(email)
        if not user or user.status == "inactive":
            return None

        otp = (
            self.db.query(LoginOtp)
            .filter(LoginOtp.email == email)
            .order_by(LoginOtp.created_at.desc())
            .first()
        )
        if not otp or as_utc(otp.expires_at) < utcnow():
            return None
        if otp.attempts >= OTP_MAX_ATTEMPTS:
            return None

        otp.attempts += 1
        self.db.commit()

        if not verify_password(code.strip(), otp.code_hash):
            return None

        self.db.query(LoginOtp).filter(LoginOtp.email == email).delete()
        self.db.commit()
        return self._issue_tokens(user)

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
        password = data.get("password") or secrets.token_urlsafe(32)
        user = User(
            first_name=data["first_name"],
            last_name=data["last_name"],
            email=data["email"],
            hashed_password=get_password_hash(password),
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
        if "password" in data:
            del data["password"]
        if "email" in data and data["email"] and data["email"] != user.email:
            existing = self.repo.get_by_email(data["email"])
            if existing:
                raise ValueError("Email already registered")
        if "department_ids" in data and data["department_ids"] is not None:
            from app.models import Department
            depts = self.db.query(Department).filter(Department.id.in_(data["department_ids"])).all()
            user.departments = depts
            del data["department_ids"]
        for key, value in data.items():
            if value is not None and hasattr(user, key):
                setattr(user, key, value)
        return self.repo.update(user)

    def delete_user(self, user: User) -> None:
        from app.models import (
            ActivityLog,
            Attachment,
            Comment,
            Department,
            LoginOtp,
            MeetingLog,
            Project,
            Task,
            TaskVersion,
            VersionComment,
        )

        uid = user.id

        blockers: list[str] = []
        if self.db.query(Task).filter(Task.created_by_id == uid).count():
            blockers.append("created tasks")
        if self.db.query(Comment).filter(Comment.author_id == uid).count():
            blockers.append("task comments")
        if self.db.query(VersionComment).filter(VersionComment.author_id == uid).count():
            blockers.append("review comments")
        if self.db.query(Attachment).filter(Attachment.uploaded_by_id == uid).count():
            blockers.append("attachments")
        if self.db.query(TaskVersion).filter(TaskVersion.created_by_id == uid).count():
            blockers.append("task submissions")
        if blockers:
            raise ValueError(
                f"Cannot delete user: linked to {', '.join(blockers)}. "
                "Reassign or remove that work first, or set status to inactive instead."
            )

        self.db.query(User).filter(User.manager_id == uid).update({User.manager_id: None})
        self.db.query(Department).filter(Department.manager_id == uid).update({Department.manager_id: None})
        self.db.query(Project).filter(Project.created_by_id == uid).update({Project.created_by_id: None})
        self.db.query(Task).filter(Task.reviewer_id == uid).update({Task.reviewer_id: None})
        self.db.query(Task).filter(Task.updated_by_id == uid).update({Task.updated_by_id: None})
        self.db.query(Task).filter(Task.deleted_by_id == uid).update({Task.deleted_by_id: None})
        self.db.query(Task).filter(Task.blocked_by_id == uid).update({Task.blocked_by_id: None})
        self.db.query(Task).filter(Task.bug_reported_by_id == uid).update({Task.bug_reported_by_id: None})
        self.db.query(TaskVersion).filter(TaskVersion.reviewer_id == uid).update({TaskVersion.reviewer_id: None})
        self.db.query(ActivityLog).filter(ActivityLog.user_id == uid).delete()
        self.db.query(LoginOtp).filter(LoginOtp.email == user.email).delete()
        self.db.query(MeetingLog).filter(MeetingLog.user_id == uid).delete()

        self.db.delete(user)
        self.db.commit()


# NotificationService lives in notification_service.py
