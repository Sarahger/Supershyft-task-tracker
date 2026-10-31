import logging
import os

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, UploadFile
from fastapi.responses import FileResponse, RedirectResponse, Response
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.constants import WORK_VAULT_CATEGORIES
from app.core.dependencies import get_current_user
from app.db.database import get_db
from app.models import User
from app.schemas.common import APIResponse
from app.schemas.work_vault import WorkVaultResourceUpdate
from app.services.storage import (
    StorageError,
    delete_stored_file,
    fetch_blob_bytes,
    fetch_url_bytes,
    is_private_blob_url,
    store_file,
)
from app.services.work_vault_service import WorkVaultService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/work-vault", tags=["work-vault"])


def _file_response(content: bytes, filename: str, mime: str, content_type: str | None = None) -> Response:
    safe_name = filename.replace('"', "")
    return Response(
        content=content,
        media_type=content_type or mime,
        headers={
            "Content-Disposition": f'inline; filename="{safe_name}"',
            "Cache-Control": "private, max-age=60",
        },
    )


@router.get("/categories")
def list_categories(current_user: User = Depends(get_current_user)):
    return APIResponse(data=[{"value": name, "label": name} for name in WORK_VAULT_CATEGORIES])


@router.get("/unread-count")
def unread_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return APIResponse(data=WorkVaultService(db).unread_count(current_user))


@router.post("/seen")
def mark_seen(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return APIResponse(data=WorkVaultService(db).mark_seen(current_user))


@router.get("/people")
def list_people(
    q: str | None = Query(None),
    category: str | None = Query(None),
    file_kind: str | None = Query(None),
    uploaded_by_id: int | None = Query(None),
    project_id: int | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    data = WorkVaultService(db).list_people(
        current_user,
        q=q,
        category=category,
        file_kind=file_kind,
        uploaded_by_id=uploaded_by_id,
        project_id=project_id,
    )
    return APIResponse(data=data)


@router.get("/facets")
def list_facets(
    q: str | None = Query(None),
    category: str | None = Query(None),
    file_kind: str | None = Query(None),
    uploaded_by_id: int | None = Query(None),
    project_id: int | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    data = WorkVaultService(db).facets(
        q=q,
        category=category,
        file_kind=file_kind,
        uploaded_by_id=uploaded_by_id,
        project_id=project_id,
    )
    return APIResponse(data=data)


@router.get("/resources")
def list_resources(
    q: str | None = Query(None),
    category: str | None = Query(None),
    file_kind: str | None = Query(None),
    uploaded_by_id: int | None = Query(None),
    project_id: int | None = Query(None),
    sort: str = Query("recent"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    data = WorkVaultService(db).list_resources(
        current_user,
        q=q,
        category=category,
        file_kind=file_kind,
        uploaded_by_id=uploaded_by_id,
        project_id=project_id,
        sort=sort,
        page=page,
        page_size=page_size,
    )
    return APIResponse(data=data)


@router.post("/resources")
async def create_resource(
    request: Request,
    title: str = Form(...),
    description: str = Form(...),
    category: str = Form(...),
    tags: str | None = Form(None),
    project_id: int | None = Form(None),
    url: str | None = Form(None),
    http_method: str | None = Form(None),
    file: UploadFile | None = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = WorkVaultService(db)
    stored_path = None
    stored_url = None
    file_size = None
    mime_type = None
    filename = None
    oidc_token = request.headers.get("x-vercel-oidc-token")

    if file is not None and file.filename:
        content = await file.read()
        if not content:
            raise HTTPException(status_code=400, detail="The uploaded file is empty")
        if len(content) > settings.MAX_UPLOAD_SIZE:
            raise HTTPException(status_code=400, detail="File too large (max 50 MB)")
        try:
            stored_path, stored_url = await store_file(
                content,
                file.filename or "file",
                file.content_type,
                oidc_token=oidc_token,
            )
        except StorageError as exc:
            raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
        except Exception as exc:
            logger.exception("Work Vault upload failed")
            raise HTTPException(status_code=500, detail=f"Upload failed: {exc}") from exc
        file_size = len(content)
        mime_type = file.content_type
        filename = file.filename

    try:
        resource = service.create(
            current_user,
            title=title,
            description=description,
            category=category,
            tags=tags,
            project_id=project_id,
            url=url,
            http_method=http_method,
            filename=filename,
            file_path=stored_path,
            file_size=file_size,
            mime_type=mime_type,
            stored_url=stored_url,
        )
    except HTTPException:
        if stored_path:
            await delete_stored_file(stored_path, stored_url, oidc_token=oidc_token)
        raise
    return APIResponse(data=service.to_dict(resource, current_user), message="Resource uploaded")


@router.get("/resources/{resource_id}")
def get_resource(
    resource_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = WorkVaultService(db)
    resource = service.get(resource_id)
    return APIResponse(data=service.to_dict(resource, current_user))


@router.patch("/resources/{resource_id}")
def update_resource(
    resource_id: int,
    body: WorkVaultResourceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = WorkVaultService(db)
    resource = service.update(current_user, resource_id, body.model_dump(exclude_unset=True))
    return APIResponse(data=service.to_dict(resource, current_user), message="Resource updated")


@router.post("/resources/{resource_id}/file")
async def replace_file(
    resource_id: int,
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="The uploaded file is empty")
    if len(content) > settings.MAX_UPLOAD_SIZE:
        raise HTTPException(status_code=400, detail="File too large (max 50 MB)")
    oidc_token = request.headers.get("x-vercel-oidc-token")
    try:
        stored_path, stored_url = await store_file(
            content,
            file.filename or "file",
            file.content_type,
            oidc_token=oidc_token,
        )
    except StorageError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
    except Exception as exc:
        logger.exception("Work Vault file replace failed")
        raise HTTPException(status_code=500, detail=f"Upload failed: {exc}") from exc

    service = WorkVaultService(db)
    try:
        resource, old_path, old_url = service.replace_file(
            current_user,
            resource_id,
            filename=file.filename or "file",
            file_path=stored_path,
            file_size=len(content),
            mime_type=file.content_type,
            stored_url=stored_url,
        )
    except HTTPException:
        await delete_stored_file(stored_path, stored_url, oidc_token=oidc_token)
        raise
    if old_path:
        await delete_stored_file(old_path, old_url, oidc_token=oidc_token)
    return APIResponse(data=service.to_dict(resource, current_user), message="File replaced")


@router.delete("/resources/{resource_id}")
async def delete_resource(
    resource_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = WorkVaultService(db)
    file_path, stored_url = service.delete(current_user, resource_id)
    oidc_token = request.headers.get("x-vercel-oidc-token")
    if file_path:
        await delete_stored_file(file_path, stored_url, oidc_token=oidc_token)
    return APIResponse(data=None, message="Resource deleted")


@router.get("/resources/{resource_id}/download")
async def download_resource(
    resource_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    resource = WorkVaultService(db).get(resource_id)
    if resource.resource_type == "link":
        raise HTTPException(status_code=400, detail="This resource is an external link")

    oidc_token = request.headers.get("x-vercel-oidc-token")
    filename = resource.filename or "download"
    mime = resource.mime_type or "application/octet-stream"

    blob_pathname = None
    if resource.file_path and (
        resource.file_path.startswith("attachments/")
        or "blob.vercel-storage.com" in (resource.file_path or "")
    ):
        blob_pathname = resource.file_path.lstrip("/")

    stored_url = resource.url or ""
    if blob_pathname or "blob.vercel-storage.com" in stored_url:
        try:
            if stored_url and is_private_blob_url(stored_url):
                content, content_type = await fetch_url_bytes(stored_url, oidc_token=oidc_token)
                return _file_response(content, filename, mime, content_type)
            if blob_pathname:
                content, content_type = await fetch_blob_bytes(blob_pathname, oidc_token=oidc_token)
                return _file_response(content, filename, mime, content_type)
            if stored_url:
                content, content_type = await fetch_url_bytes(stored_url, oidc_token=oidc_token)
                return _file_response(content, filename, mime, content_type)
        except Exception as exc:
            logger.exception("Work Vault blob download failed for %s", resource_id)
            raise HTTPException(status_code=404, detail=f"Could not read this file. ({exc})") from exc

    if stored_url:
        return RedirectResponse(stored_url)

    if resource.file_path and os.path.exists(resource.file_path):
        return FileResponse(
            resource.file_path,
            filename=filename,
            media_type=mime,
            content_disposition_type="inline",
        )

    raise HTTPException(status_code=404, detail="File not found")
