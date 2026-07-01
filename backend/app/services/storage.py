import os
import uuid

import httpx

from app.core.config import settings

BLOB_API = "https://blob.vercel-storage.com"


def use_vercel_blob() -> bool:
    return bool(os.getenv("BLOB_READ_WRITE_TOKEN"))


async def store_file(content: bytes, filename: str, mime_type: str | None) -> tuple[str, str | None]:
    """
    Persist uploaded bytes. Returns (storage_key, public_url).
    public_url is set when using Vercel Blob; local dev uses disk only.
    """
    ext = os.path.splitext(filename or "file")[1]
    storage_key = f"attachments/{uuid.uuid4()}{ext}"

    if use_vercel_blob():
        token = os.environ["BLOB_READ_WRITE_TOKEN"]
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.put(
                f"{BLOB_API}/{storage_key}",
                content=content,
                headers={
                    "Authorization": f"Bearer {token}",
                    "x-api-version": "7",
                    "x-content-type": mime_type or "application/octet-stream",
                    "x-filename": filename or storage_key,
                },
            )
            response.raise_for_status()
            data = response.json()
            return data.get("pathname") or storage_key, data.get("url")

    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    filepath = os.path.join(settings.UPLOAD_DIR, os.path.basename(storage_key))
    with open(filepath, "wb") as handle:
        handle.write(content)
    return filepath, None


async def fetch_blob_bytes(pathname: str) -> tuple[bytes, str]:
    token = os.environ.get("BLOB_READ_WRITE_TOKEN")
    if not token:
        raise FileNotFoundError("Blob storage not configured")
    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.get(
            f"{BLOB_API}/{pathname.lstrip('/')}",
            headers={"Authorization": f"Bearer {token}", "x-api-version": "7"},
        )
        response.raise_for_status()
        content_type = response.headers.get("content-type", "application/octet-stream")
        return response.content, content_type
