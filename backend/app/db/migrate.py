import logging

from sqlalchemy import inspect, text

logger = logging.getLogger(__name__)


def run_lightweight_migrations(engine) -> None:
    """Apply additive schema changes for existing databases (SQLite or PostgreSQL)."""
    inspector = inspect(engine)
    tables = inspector.get_table_names()

    if "task_dependencies" in tables:
        cols = {c["name"] for c in inspector.get_columns("task_dependencies")}
        if "depends_on_user_id" not in cols:
            dialect = engine.dialect.name
            if dialect == "postgresql":
                sql = (
                    "ALTER TABLE task_dependencies "
                    "ADD COLUMN IF NOT EXISTS depends_on_user_id INTEGER "
                    "REFERENCES users(id)"
                )
            else:
                sql = (
                    "ALTER TABLE task_dependencies "
                    "ADD COLUMN depends_on_user_id INTEGER REFERENCES users(id)"
                )
            with engine.begin() as conn:
                conn.execute(text(sql))
            logger.info("Added task_dependencies.depends_on_user_id column")

    if "users" in tables:
        user_cols = {c["name"] for c in inspector.get_columns("users")}
        user_additions = [
            ("email_notifications_enabled", "BOOLEAN NOT NULL DEFAULT TRUE"),
            ("notify_task_assigned", "BOOLEAN NOT NULL DEFAULT TRUE"),
            ("notify_task_updates", "BOOLEAN NOT NULL DEFAULT TRUE"),
            ("notify_reviews", "BOOLEAN NOT NULL DEFAULT TRUE"),
            ("notify_comments", "BOOLEAN NOT NULL DEFAULT TRUE"),
        ]
        dialect = engine.dialect.name
        for col_name, col_def in user_additions:
            if col_name not in user_cols:
                if dialect == "postgresql":
                    sql = f"ALTER TABLE users ADD COLUMN IF NOT EXISTS {col_name} {col_def}"
                elif dialect == "sqlite":
                    sql = f"ALTER TABLE users ADD COLUMN {col_name} INTEGER NOT NULL DEFAULT 1"
                else:
                    sql = f"ALTER TABLE users ADD COLUMN {col_name} {col_def}"
                with engine.begin() as conn:
                    conn.execute(text(sql))
                logger.info("Added users.%s column", col_name)

    if "tasks" in tables:
        task_cols = {c["name"] for c in inspector.get_columns("tasks")}
        dialect = engine.dialect.name
        if dialect == "postgresql":
            task_additions = [
                ("deletion_reason", "TEXT"),
                ("deleted_by_id", "INTEGER REFERENCES users(id)"),
                ("deleted_at", "TIMESTAMP WITH TIME ZONE"),
            ]
        else:
            task_additions = [
                ("deletion_reason", "TEXT"),
                ("deleted_by_id", "INTEGER REFERENCES users(id)"),
                ("deleted_at", "DATETIME"),
            ]
        for col_name, col_def in task_additions:
            if col_name not in task_cols:
                if dialect == "postgresql":
                    sql = f"ALTER TABLE tasks ADD COLUMN IF NOT EXISTS {col_name} {col_def}"
                else:
                    sql = f"ALTER TABLE tasks ADD COLUMN {col_name} {col_def}"
                with engine.begin() as conn:
                    conn.execute(text(sql))
                logger.info("Added tasks.%s column", col_name)

    if "meeting_logs" in tables:
        log_cols = {c["name"] for c in inspector.get_columns("meeting_logs")}
        dialect = engine.dialect.name
        log_additions = [
            ("meet_url", "VARCHAR(500)"),
            ("pool_id", "INTEGER"),
        ]
        for col_name, col_def in log_additions:
            if col_name not in log_cols:
                if dialect == "postgresql":
                    sql = f"ALTER TABLE meeting_logs ADD COLUMN IF NOT EXISTS {col_name} {col_def}"
                else:
                    sql = f"ALTER TABLE meeting_logs ADD COLUMN {col_name} {col_def}"
                with engine.begin() as conn:
                    conn.execute(text(sql))
                logger.info("Added meeting_logs.%s column", col_name)
