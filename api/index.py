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

_main_app = None
_import_error: Exception | None = None
_import_traceback = ""

try:
    from app.main import app as _main_app
except Exception as exc:
    _import_error = exc
    _import_traceback = traceback.format_exc()

if _main_app is not None:
    app = _main_app
else:
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
                "error": str(_import_error),
                "type": type(_import_error).__name__ if _import_error else "Unknown",
                "traceback": _import_traceback,
                "backend_path": BACKEND,
                "backend_exists": os.path.isdir(BACKEND),
                "backend_app_exists": os.path.isdir(os.path.join(BACKEND, "app")),
                "sys_path_head": sys.path[:8],
            },
        )
