import os
import uuid
from urllib.parse import quote

import httpx

from app.core.config import settings

BLOB_API = "https://vercel.com/api/blob"
BLOB_API_VERSION = "12"
LEGACY_BLOB_API = "https://blob.vercel-storage.com"
LEGACY_BLOB_API_VERSION = "7"


class StorageError(Exception):
    def __init__(self, message: str, status_code: int = 503):
        self.message = message
        self.status_code = status_code
        super().__init__(message)


def _is_vercel() -> bool:
    return os.getenv("VERCEL") == "1"


def _normalize_store_id(store_id: str) -> str:
    return store_id.strip().removeprefix("store_")


def _store_id_from_env() -> str | None:
    raw = os.getenv("BLOB_STORE_ID")
    if raw and raw.strip():
        return _normalize_store_id(raw)
    return None


def _read_write_token() -> str | None:
    token = os.getenv("BLOB_READ_WRITE_TOKEN") or settings.BLOB_READ_WRITE_TOKEN
    return token.strip() if token else None


def _parse_store_id_from_token(token: str) -> str:
    parts = token.split("_")
    if len(parts) < 4:
        return ""
    return _normalize_store_id(parts[3])


def _resolve_blob_auth() -> tuple[str, str] | None:
    """
    Resolve Blob credentials.
    Prefer Vercel OIDC (BLOB_STORE_ID + VERCEL_OIDC_TOKEN), then legacy read-write token.
    """
    store_id = _store_id_from_env()
    oidc_token = os.getenv("VERCEL_OIDC_TOKEN")
    if oidc_token and store_id:
        return oidc_token, store_id

    read_write = _read_write_token()
    if read_write:
        parsed_store = _parse_store_id_from_token(read_write)
        return read_write, parsed_store or store_id or ""

    return None


def use_vercel_blob() -> bool:
    return _resolve_blob_auth() is not None


def _blob_headers(
    token: str,
    store_id: str,
    *,
    mime_type: str | None = None,
    for_upload: bool = False,
) -> dict[str, str]:
    headers = {"Authorization": f"Bearer {token}"}

    if store_id:
        headers.update(
            {
                "x-api-version": BLOB_API_VERSION,
                "x-vercel-blob-store-id": store_id,
            }
        )
        if for_upload:
            headers.update(
                {
                    "x-vercel-blob-access": "public",
                    "x-content-type": mime_type or "application/octet-stream",
                    "x-add-random-suffix": "0",
                }
            )
    elif for_upload:
        headers.update(
            {
                "x-api-version": LEGACY_BLOB_API_VERSION,
                "x-content-type": mime_type or "application/octet-stream",
            }
        )
    else:
        headers["x-api-version"] = LEGACY_BLOB_API_VERSION

    return headers


async def _upload_to_vercel_blob(
    content: bytes,
    storage_key: str,
    filename: str,
    mime_type: str | None,
    token: str,
    store_id: str,
) -> tuple[str, str | None]:
    headers = _blob_headers(token, store_id, mime_type=mime_type, for_upload=True)
    if not store_id:
        headers["x-filename"] = filename or storage_key
        url = f"{LEGACY_BLOB_API}/{storage_key}"
    else:
        url = f"{BLOB_API}/?pathname={quote(storage_key, safe='')}"

    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.put(url, content=content, headers=headers)
        try:
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            detail = exc.response.text[:300] if exc.response.text else str(exc)
            raise StorageError(f"File storage upload failed: {detail}", status_code=502) from exc
        data = response.json()
        return data.get("pathname") or storage_key, data.get("url")


async def store_file(content: bytes, filename: str, mime_type: str | None) -> tuple[str, str | None]:
    """
    Persist uploaded bytes. Returns (storage_key, public_url).
    public_url is set when using Vercel Blob; local dev uses disk only.
    """
    ext = os.path.splitext(filename or "file")[1]
    storage_key = f"attachments/{uuid.uuid4()}{ext}"
    auth = _resolve_blob_auth()

    if _is_vercel():
        if not auth:
            raise StorageError(
                "File storage is not configured on Vercel. "
                "Link a Blob store to this project in the Vercel dashboard (Storage → Blob).",
            )
        token, store_id = auth
        if not store_id:
            raise StorageError(
                "Blob store ID is missing. Re-link your Blob store to this project in the Vercel dashboard.",
            )
        return await _upload_to_vercel_blob(content, storage_key, filename, mime_type, token, store_id)

    if auth:
        token, store_id = auth
        return await _upload_to_vercel_blob(content, storage_key, filename, mime_type, token, store_id)

    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    filepath = os.path.join(settings.UPLOAD_DIR, os.path.basename(storage_key))
    with open(filepath, "wb") as handle:
        handle.write(content)
    return filepath, None


async def fetch_blob_bytes(pathname: str) -> tuple[bytes, str]:
    auth = _resolve_blob_auth()
    if not auth:
        raise FileNotFoundError("Blob storage not configured")
    token, store_id = auth
    headers = _blob_headers(token, store_id)

    if store_id:
        url = f"{BLOB_API}/?pathname={quote(pathname.lstrip('/'), safe='')}"
    else:
        url = f"{LEGACY_BLOB_API}/{pathname.lstrip('/')}"

    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.get(url, headers=headers)
        response.raise_for_status()
        content_type = response.headers.get("content-type", "application/octet-stream")
        return response.content, content_type
