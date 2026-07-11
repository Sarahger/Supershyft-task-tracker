import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.api import auth, clients, custom_fields, dashboard, departments, meetings, projects, tasks, users
from app.core.config import settings
from app.db.base import Base
from app.db.database import engine
from app.db.migrate import run_lightweight_migrations

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # On Vercel, bootstrap runs in api/index.py (lifespan is disabled for serverless)
    if os.getenv("VERCEL") != "1":
        Base.metadata.create_all(bind=engine)
        run_lightweight_migrations(engine)
        try:
            from app.db.database import SessionLocal
            from app.services.meet_pool_service import seed_meet_pool

            db = SessionLocal()
            try:
                seed_meet_pool(db)
            finally:
                db.close()
        except Exception as exc:
            logger.warning("Meet pool seed skipped or failed: %s", exc)
    if os.getenv("VERCEL") != "1":
        os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    if settings.AUTO_SEED and os.getenv("VERCEL") != "1":
        try:
            from app.db.seed import seed
            seed()
        except Exception as exc:
            logger.warning("Auto-seed skipped or failed: %s", exc)
    logger.info("Application started")
    yield
    logger.info("Application shutdown")


_is_vercel = os.getenv("VERCEL") == "1"

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    lifespan=lifespan if not _is_vercel else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"success": False, "message": "Internal server error", "errors": []},
    )


app.include_router(auth.router, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(departments.router, prefix="/api")
app.include_router(projects.router, prefix="/api")
app.include_router(clients.router, prefix="/api")
app.include_router(tasks.router, prefix="/api")
app.include_router(custom_fields.router, prefix="/api")
app.include_router(dashboard.router, prefix="/api")
app.include_router(meetings.router, prefix="/api")

if not _is_vercel and os.path.exists(settings.UPLOAD_DIR):
    app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")


@app.get("/api/health")
@app.get("/health")
def health():
    return {"success": True, "data": {"status": "healthy"}, "message": "OK"}
