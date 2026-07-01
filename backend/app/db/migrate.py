import logging

from sqlalchemy import inspect, text

logger = logging.getLogger(__name__)


def run_lightweight_migrations(engine) -> None:
    """Apply additive schema changes for existing SQLite databases."""
    inspector = inspect(engine)
    tables = inspector.get_table_names()

    if "task_dependencies" in tables:
        cols = {c["name"] for c in inspector.get_columns("task_dependencies")}
        if "depends_on_user_id" not in cols:
            with engine.begin() as conn:
                conn.execute(
                    text(
                        "ALTER TABLE task_dependencies "
                        "ADD COLUMN depends_on_user_id INTEGER REFERENCES users(id)"
                    )
                )
            logger.info("Added task_dependencies.depends_on_user_id column")
