import logging
import os
import sys

logger = logging.getLogger(__name__)

# Vercel runs this file from /var/task/api — add backend package to import path
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BACKEND = os.path.join(ROOT, "backend")
if BACKEND not in sys.path:
    sys.path.insert(0, BACKEND)

if not os.path.isdir(os.path.join(BACKEND, "app")):
    raise RuntimeError(
        f"backend/app not found at {BACKEND}. "
        "Ensure vercel.json functions.includeFiles includes backend/**"
    )

from app.main import app  # noqa: E402


def _bootstrap_database() -> None:
    """Initialize schema and seed on Vercel (lifespan is disabled in serverless)."""
    if os.getenv("VERCEL") != "1":
        return
    try:
        from app.core.config import settings
        from app.db.base import Base
        from app.db.database import engine
        from app.db.migrate import run_lightweight_migrations

        Base.metadata.create_all(bind=engine)
        run_lightweight_migrations(engine)
        from app.db.database import SessionLocal
        from app.services.meet_pool_service import seed_meet_pool

        db = SessionLocal()
        try:
            seed_meet_pool(db)
            from app.services.task_cleanup import maybe_run_task_retention_cleanup

            maybe_run_task_retention_cleanup(db, force=True)
        finally:
            db.close()
        if settings.allow_demo_seed:
            from app.db.seed import seed

            seed()
        if settings.SECRET_KEY == "change-this-secret-key-in-production-use-env-var":
            logger.error("SECRET_KEY is the insecure default — set a unique value on Vercel")
        if settings.is_sqlite:
            logger.error("DATABASE_URL is SQLite — production needs a Neon PostgreSQL URL")
        if settings.DEBUG:
            logger.warning("DEBUG is true on Vercel")
        if settings.AUTO_SEED:
            logger.warning("AUTO_SEED is ignored on Vercel so demo users and tasks are not inserted")
        logger.info("Vercel database bootstrap complete")
    except Exception as exc:
        logger.error("Vercel database bootstrap failed: %s", exc, exc_info=True)


_bootstrap_database()
