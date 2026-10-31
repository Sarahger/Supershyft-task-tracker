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
            ("notify_meetings", "BOOLEAN NOT NULL DEFAULT TRUE"),
            ("telegram_notifications_enabled", "BOOLEAN NOT NULL DEFAULT TRUE"),
            ("telegram_daily_digest_enabled", "BOOLEAN NOT NULL DEFAULT FALSE"),
        ]
        dialect = engine.dialect.name
        for col_name, col_def in user_additions:
            if col_name not in user_cols:
                if dialect == "postgresql":
                    sql = f"ALTER TABLE users ADD COLUMN IF NOT EXISTS {col_name} {col_def}"
                elif dialect == "sqlite":
                    default = "0" if "DEFAULT FALSE" in col_def.upper() else "1"
                    sql = f"ALTER TABLE users ADD COLUMN {col_name} INTEGER NOT NULL DEFAULT {default}"
                else:
                    sql = f"ALTER TABLE users ADD COLUMN {col_name} {col_def}"
                with engine.begin() as conn:
                    conn.execute(text(sql))
                logger.info("Added users.%s column", col_name)
        if "last_seen_announcements_at" not in user_cols:
            if dialect == "postgresql":
                sql = "ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen_announcements_at TIMESTAMP WITH TIME ZONE"
            else:
                sql = "ALTER TABLE users ADD COLUMN last_seen_announcements_at DATETIME"
            with engine.begin() as conn:
                conn.execute(text(sql))
            logger.info("Added users.last_seen_announcements_at column")
        if "weekly_updates_adopted_at" not in user_cols:
            if dialect == "postgresql":
                sql = "ALTER TABLE users ADD COLUMN IF NOT EXISTS weekly_updates_adopted_at TIMESTAMP WITH TIME ZONE"
            else:
                sql = "ALTER TABLE users ADD COLUMN weekly_updates_adopted_at DATETIME"
            with engine.begin() as conn:
                conn.execute(text(sql))
            logger.info("Added users.weekly_updates_adopted_at column")
        if "last_seen_work_vault_at" not in user_cols:
            if dialect == "postgresql":
                sql = "ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen_work_vault_at TIMESTAMP WITH TIME ZONE"
            else:
                sql = "ALTER TABLE users ADD COLUMN last_seen_work_vault_at DATETIME"
            with engine.begin() as conn:
                conn.execute(text(sql))
            logger.info("Added users.last_seen_work_vault_at column")

    if "tasks" in tables:
        task_cols = {c["name"] for c in inspector.get_columns("tasks")}
        dialect = engine.dialect.name
        if dialect == "postgresql":
            task_additions = [
                ("deletion_reason", "TEXT"),
                ("deleted_by_id", "INTEGER REFERENCES users(id)"),
                ("deleted_at", "TIMESTAMP WITH TIME ZONE"),
                ("end_date", "TIMESTAMP WITH TIME ZONE"),
                ("original_due_date", "TIMESTAMP WITH TIME ZONE"),
            ]
        else:
            task_additions = [
                ("deletion_reason", "TEXT"),
                ("deleted_by_id", "INTEGER REFERENCES users(id)"),
                ("deleted_at", "DATETIME"),
                ("end_date", "DATETIME"),
                ("original_due_date", "DATETIME"),
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

    if "work_vault_resources" in tables:
        dialect = engine.dialect.name
        vault_cols = {c["name"] for c in inspector.get_columns("work_vault_resources")}
        if "http_method" not in vault_cols:
            if dialect == "postgresql":
                sql = "ALTER TABLE work_vault_resources ADD COLUMN IF NOT EXISTS http_method VARCHAR(10)"
            else:
                sql = "ALTER TABLE work_vault_resources ADD COLUMN http_method VARCHAR(10)"
            with engine.begin() as conn:
                conn.execute(text(sql))
            logger.info("Added work_vault_resources.http_method column")
        with engine.begin() as conn:
            result = conn.execute(
                text(
                    "UPDATE work_vault_resources SET category = 'API Integration' "
                    "WHERE category = 'API Documentation'"
                )
            )
            if result.rowcount:
                logger.info("Renamed %s Work Vault categories to API Integration", result.rowcount)
        inspector = inspect(engine)
        tables = inspector.get_table_names()
        dialect = engine.dialect.name
        if "work_vault_folders" not in tables:
            if dialect == "postgresql":
                create_sql = (
                    "CREATE TABLE IF NOT EXISTS work_vault_folders ("
                    "id SERIAL PRIMARY KEY, "
                    "name VARCHAR(300) NOT NULL, "
                    "owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, "
                    "created_by_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, "
                    "created_at TIMESTAMPTZ, "
                    "CONSTRAINT uq_work_vault_folder_owner_name UNIQUE (owner_id, name)"
                    ")"
                )
            else:
                create_sql = (
                    "CREATE TABLE IF NOT EXISTS work_vault_folders ("
                    "id INTEGER PRIMARY KEY AUTOINCREMENT, "
                    "name VARCHAR(300) NOT NULL, "
                    "owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, "
                    "created_by_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, "
                    "created_at DATETIME, "
                    "CONSTRAINT uq_work_vault_folder_owner_name UNIQUE (owner_id, name)"
                    ")"
                )
            with engine.begin() as conn:
                conn.execute(text(create_sql))
            logger.info("Created work_vault_folders table")
            inspector = inspect(engine)
        vault_cols = {c["name"] for c in inspector.get_columns("work_vault_resources")}
        if "folder_id" not in vault_cols:
            if dialect == "postgresql":
                col_sql = (
                    "ALTER TABLE work_vault_resources ADD COLUMN IF NOT EXISTS folder_id INTEGER "
                    "REFERENCES work_vault_folders(id) ON DELETE SET NULL"
                )
            else:
                col_sql = "ALTER TABLE work_vault_resources ADD COLUMN folder_id INTEGER REFERENCES work_vault_folders(id)"
            with engine.begin() as conn:
                conn.execute(text(col_sql))
            logger.info("Added work_vault_resources.folder_id column")
        with engine.begin() as conn:
            conn.execute(
                text(
                    "INSERT INTO work_vault_folders (name, owner_id, created_by_id, created_at) "
                    "SELECT r.title, r.uploaded_by_id, r.uploaded_by_id, MIN(r.created_at) "
                    "FROM work_vault_resources r "
                    "LEFT JOIN work_vault_folders f "
                    "ON f.owner_id = r.uploaded_by_id AND f.name = r.title "
                    "WHERE r.folder_id IS NULL AND f.id IS NULL "
                    "GROUP BY r.uploaded_by_id, r.title"
                )
            )
            conn.execute(
                text(
                    "UPDATE work_vault_resources SET folder_id = ("
                    "SELECT id FROM work_vault_folders "
                    "WHERE owner_id = work_vault_resources.uploaded_by_id "
                    "AND name = work_vault_resources.title"
                    ") WHERE folder_id IS NULL"
                )
            )
        existing_indexes = {idx["name"] for idx in inspector.get_indexes("work_vault_resources")}
        wanted = {
            "ix_work_vault_category_created": ("category", "created_at"),
            "ix_work_vault_uploader_created": ("uploaded_by_id", "created_at"),
            "ix_work_vault_kind_created": ("file_kind", "created_at"),
        }
        for name, cols in wanted.items():
            if name in existing_indexes:
                continue
            col_sql = ", ".join(cols)
            if dialect == "postgresql":
                sql = f"CREATE INDEX IF NOT EXISTS {name} ON work_vault_resources ({col_sql})"
            else:
                sql = f"CREATE INDEX IF NOT EXISTS {name} ON work_vault_resources ({col_sql})"
            with engine.begin() as conn:
                conn.execute(text(sql))
            logger.info("Added index %s", name)

    # Collapse legacy ready_for_review into the single Review status (in_review)
    if "tasks" in tables:
        with engine.begin() as conn:
            result = conn.execute(
                text("UPDATE tasks SET status = 'in_review' WHERE status = 'ready_for_review'")
            )
            if result.rowcount:
                logger.info("Normalized %s tasks from ready_for_review → in_review", result.rowcount)
