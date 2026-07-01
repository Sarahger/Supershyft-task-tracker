import os
import sys

# Vercel runs this file from /var/task/api — add backend package to import path
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BACKEND = os.path.join(ROOT, "backend")
if BACKEND not in sys.path:
    sys.path.insert(0, BACKEND)

from mangum import Mangum  # noqa: E402

from app.main import app  # noqa: E402

handler = Mangum(app, lifespan="auto")
