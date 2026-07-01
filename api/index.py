import os
import sys
import traceback

from fastapi import FastAPI
from fastapi.responses import JSONResponse

# Vercel runs this file from /var/task/api — add backend package to import path
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BACKEND = os.path.join(ROOT, "backend")
if BACKEND not in sys.path:
    sys.path.insert(0, BACKEND)

try:
    from app.main import app  # noqa: F401
except Exception as import_error:
    _traceback = traceback.format_exc()
    app = FastAPI()

    @app.get("/api/health")
    @app.get("/health")
    @app.get("/api/import-debug")
    async def import_debug():
        return JSONResponse(
            status_code=503,
            content={
                "success": False,
                "message": "Backend import failed",
                "error": str(import_error),
                "type": type(import_error).__name__,
                "traceback": _traceback,
                "backend_path": BACKEND,
                "backend_exists": os.path.isdir(BACKEND),
                "sys_path_head": sys.path[:6],
            },
        )
