from enum import Enum


class UserRole(str, Enum):
    ADMIN = "administrator"
    MANAGER = "manager"
    EMPLOYEE = "employee"


class UserStatus(str, Enum):
    ACTIVE = "active"
    ON_LEAVE = "on_leave"
    INACTIVE = "inactive"


class ProjectStatus(str, Enum):
    PLANNING = "planning"
    ACTIVE = "active"
    ON_HOLD = "on_hold"
    COMPLETED = "completed"
    ARCHIVED = "archived"


class ProjectHealth(str, Enum):
    HEALTHY = "healthy"
    AT_RISK = "at_risk"
    DELAYED = "delayed"
    COMPLETED = "completed"


class TaskStatus(str, Enum):
    UNASSIGNED = "unassigned"
    BACKLOG = "backlog"
    TODO = "to_do"
    IN_PROGRESS = "in_progress"
    BLOCKED = "blocked"
    READY_FOR_REVIEW = "ready_for_review"
    IN_REVIEW = "in_review"
    CHANGES_REQUESTED = "changes_requested"
    APPROVED = "approved"
    TESTING = "testing"
    BUGS_FOUND = "bugs_found"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class TaskPriority(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class TaskSeverity(str, Enum):
    MINOR = "minor"
    MAJOR = "major"
    CRITICAL = "critical"
    BLOCKER = "blocker"


class ReviewResult(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    CHANGES_REQUESTED = "changes_requested"


class AttachmentType(str, Enum):
    FILE = "file"
    LINK = "link"


class NotificationType(str, Enum):
    TASK_ASSIGNED = "task_assigned"
    TASK_REASSIGNED = "task_reassigned"
    REVIEWER_ASSIGNED = "reviewer_assigned"
    REVIEW_REQUESTED = "review_requested"
    REVIEW_APPROVED = "review_approved"
    CHANGES_REQUESTED = "changes_requested"
    TASK_BLOCKED = "task_blocked"
    TASK_UNBLOCKED = "task_unblocked"
    TASK_COMPLETED = "task_completed"
    TASK_REOPENED = "task_reopened"
    MENTION = "mention"
    COMMENT_REPLY = "comment_reply"
    TASK_COMMENT = "task_comment"
    PROJECT_UPDATE = "project_update"
    OVERDUE_TASK = "overdue_task"
    DEPENDENCY_UPDATED = "dependency_updated"


class ActivityType(str, Enum):
    TASK_CREATED = "task_created"
    TASK_UPDATED = "task_updated"
    TASK_DELETED = "task_deleted"
    STATUS_CHANGED = "status_changed"
    PRIORITY_CHANGED = "priority_changed"
    ASSIGNEE_ADDED = "assignee_added"
    ASSIGNEE_REMOVED = "assignee_removed"
    REVIEWER_ASSIGNED = "reviewer_assigned"
    REVIEW_REQUESTED = "review_requested"
    REVIEW_APPROVED = "review_approved"
    CHANGES_REQUESTED = "changes_requested"
    TESTING_STARTED = "testing_started"
    BUG_REPORTED = "bug_reported"
    TASK_REOPENED = "task_reopened"
    ATTACHMENT_UPLOADED = "attachment_uploaded"
    COMMENT_ADDED = "comment_added"
    CHECKLIST_UPDATED = "checklist_updated"
    DEPENDENCY_ADDED = "dependency_added"
    PROJECT_CHANGED = "project_changed"
    CLIENT_CHANGED = "client_changed"
    TASK_BLOCKED = "task_blocked"
    TASK_UNBLOCKED = "task_unblocked"
    TASK_COMPLETED = "task_completed"
