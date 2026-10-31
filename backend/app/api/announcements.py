import logging
import os

from datetime import date

from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile
from fastapi.responses import FileResponse, RedirectResponse, Response
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.dependencies import get_current_user
from app.db.database import get_db
from app.models import User
from app.schemas.announcement import AnnouncementCreate, AnnouncementLinkCreate
from app.schemas.common import APIResponse
from app.services.announcement_service import AnnouncementService
from app.services.storage import (
    StorageError,
    fetch_blob_bytes,
    fetch_url_bytes,
    is_private_blob_url,
    store_file,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/announcements", tags=["announcements"])


@router.get("")
def list_announcements(
    week_start: date | None = Query(None),
    author_id: int | None = Query(None),
    on_date: date | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    data = AnnouncementService(db).list_week(
        current_user,
        week_start=week_start,
        author_id=author_id,
        on_date=on_date,
    )
    return APIResponse(data=data)


@router.get("/unread-count")
def unread_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return APIResponse(data=AnnouncementService(db).unread_count(current_user))


@router.post("/seen")
def mark_seen(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return APIResponse(data=AnnouncementService(db).mark_seen(current_user))


@router.post("")
def create_announcement(
    body: AnnouncementCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    links = [link.model_dump() for link in body.links]
    data = AnnouncementService(db).create(
        current_user,
        body.body,
        body.mentioned_user_ids,
        links,
    )
    return APIResponse(data=data, message="Announcement posted")


@router.post("/{announcement_id}/links")
def add_link(
    announcement_id: int,
    body: AnnouncementLinkCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    data = AnnouncementService(db).add_link(current_user, announcement_id, body.url, body.title)
    return APIResponse(data=data)


@router.post("/{announcement_id}/attachments")
async def upload_attachment(
    announcement_id: int,
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    content = await file.read()
    if len(content) > settings.MAX_UPLOAD_SIZE:
        raise HTTPException(status_code=400, detail="File too large")
    oidc_token = request.headers.get("x-vercel-oidc-token")
    try:
        file_path, public_url = await store_file(
            content,
            file.filename or "file",
            file.content_type,
            oidc_token=oidc_token,
        )
    except StorageError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
    except Exception as exc:
        logger.exception("Announcement attachment upload failed")
        raise HTTPException(status_code=500, detail=f"Upload failed: {exc}") from exc
    data = AnnouncementService(db).add_file(
        current_user,
        announcement_id,
        filename=file.filename or "file",
        file_path=file_path,
        public_url=public_url,
        file_size=len(content),
        mime_type=file.content_type,
    )
    return APIResponse(data=data)


@router.post("/{announcement_id}/reactions")
def toggle_reaction(
    announcement_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    data = AnnouncementService(db).toggle_reaction(current_user, announcement_id)
    return APIResponse(data=data)


@router.delete("/{announcement_id}")
def delete_announcement(
    announcement_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    AnnouncementService(db).delete(current_user, announcement_id)
    return APIResponse(data=None, message="Announcement deleted")


@router.get("/attachments/{attachment_id}/download")
async def download_attachment(
    attachment_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    attachment = AnnouncementService(db).get_attachment(attachment_id)
    oidc_token = request.headers.get("x-vercel-oidc-token")
    filename = attachment.filename or "download"
    mime = attachment.mime_type or "application/octet-stream"

    def _file_response(content: bytes, content_type: str | None = None) -> Response:
        return Response(
            content=content,
            media_type=content_type or mime,
            headers={
                "Content-Disposition": f'inline; filename="{filename}"',
                "Cache-Control": "private, max-age=60",
            },
        )

    blob_pathname = None
    if attachment.file_path and (
        attachment.file_path.startswith("attachments/")
        or "blob.vercel-storage.com" in (attachment.file_path or "")
    ):
        blob_pathname = attachment.file_path.lstrip("/")

    if blob_pathname or (attachment.url and "blob.vercel-storage.com" in (attachment.url or "")):
        try:
            if attachment.url and is_private_blob_url(attachment.url):
                content, content_type = await fetch_url_bytes(attachment.url, oidc_token=oidc_token)
                return _file_response(content, content_type)
            if blob_pathname:
                content, content_type = await fetch_blob_bytes(blob_pathname, oidc_token=oidc_token)
                return _file_response(content, content_type)
            if attachment.url:
                content, content_type = await fetch_url_bytes(attachment.url, oidc_token=oidc_token)
                return _file_response(content, content_type)
        except Exception as exc:
            logger.exception("Announcement blob download failed for %s", attachment_id)
            raise HTTPException(status_code=404, detail=f"Could not read this file. ({exc})") from exc

    if attachment.url:
        return RedirectResponse(attachment.url)

    if attachment.file_path and os.path.exists(attachment.file_path):
        return FileResponse(attachment.file_path, filename=filename, media_type=mime)

    raise HTTPException(status_code=404, detail="File not found")
