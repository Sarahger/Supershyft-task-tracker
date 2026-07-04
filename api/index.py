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
        if settings.AUTO_SEED:
            from app.db.seed import seed

            seed()
        logger.info("Vercel database bootstrap complete")
    except Exception as exc:
        logger.warning("Vercel database bootstrap failed: %s", exc)


_bootstrap_database()
