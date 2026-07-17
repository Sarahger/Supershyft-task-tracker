from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.dependencies import get_current_user
from app.db.database import get_db
from app.models import User
from app.schemas.common import APIResponse
from app.schemas.user import OtpRequest, OtpVerify, RefreshRequest
from app.services.auth_service import AuthService
from app.services.notification_service import notification_preferences_dict
from app.services.storage import StorageError, delete_stored_file, store_file
import logging
import os
from urllib.parse import urlparse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])

ALLOWED_PROFILE_IMAGE_TYPES = {
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/gif",
}
MAX_PROFILE_PICTURE_SIZE = 5 * 1024 * 1024  # 5MB


async def _delete_profile_picture_file(url: str | None, oidc_token: str | None = None) -> None:
    if not url:
        return
    try:
        if url.startswith("/uploads/"):
            relative = url.removeprefix("/uploads/").lstrip("/")
            local_path = os.path.join(settings.UPLOAD_DIR, relative)
            await delete_stored_file(local_path, None)
            return
        parsed = urlparse(url)
        pathname = parsed.path.lstrip("/")
        if pathname:
            await delete_stored_file(pathname, url, oidc_token=oidc_token)
    except Exception:
        logger.warning("Failed to delete previous profile picture: %s", url, exc_info=True)


def _local_upload_url(file_path: str) -> str:
    return f"/uploads/{os.path.basename(file_path)}"



@router.post("/request-otp")
def request_otp(data: OtpRequest, db: Session = Depends(get_db)):
    service = AuthService(db)
    try:
        service.request_otp(data.email)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return APIResponse(message="If an account exists, a login code has been sent to your email")


@router.post("/verify-otp")
def verify_otp(data: OtpVerify, db: Session = Depends(get_db)):
    service = AuthService(db)
    result = service.verify_otp(data.email, data.code)
    if not result:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired code")
    return APIResponse(
        data={
            "access_token": result["access_token"],
            "refresh_token": result["refresh_token"],
            "token_type": "bearer",
            "user": _user_response(result["user"]),
        },
        message="Login successful",
    )


@router.post("/refresh")
def refresh(data: RefreshRequest, db: Session = Depends(get_db)):
    service = AuthService(db)
    result = service.refresh(data.refresh_token)
    if not result:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")
    return APIResponse(
        data={
            "access_token": result["access_token"],
            "user": _user_response(result["user"]),
        },
        message="Token refreshed",
    )


@router.post("/logout")
def logout(data: RefreshRequest, db: Session = Depends(get_db)):
    AuthService(db).logout(data.refresh_token)
    return APIResponse(message="Logged out successfully")


@router.get("/me")
def get_me(current_user=Depends(get_current_user)):
    return APIResponse(data=_user_response(current_user))


@router.post("/me/profile-picture")
async def upload_profile_picture(
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    content_type = (file.content_type or "").lower()
    if content_type not in ALLOWED_PROFILE_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail="Please upload a JPEG, PNG, WebP, or GIF image")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty file")
    if len(content) > MAX_PROFILE_PICTURE_SIZE:
        raise HTTPException(status_code=400, detail="Image must be 5MB or smaller")

    oidc_token = request.headers.get("x-vercel-oidc-token")
    try:
        file_path, public_url = await store_file(
            content,
            file.filename or "profile.jpg",
            content_type,
            oidc_token=oidc_token,
        )
    except StorageError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
    except Exception as exc:
        logger.exception("Profile picture upload failed for user %s", current_user.id)
        raise HTTPException(status_code=500, detail=f"Upload failed: {exc}") from exc

    picture_url = public_url or _local_upload_url(file_path)
    old_url = current_user.profile_picture
    current_user.profile_picture = picture_url
    db.commit()
    db.refresh(current_user)

    if old_url and old_url != picture_url:
        await _delete_profile_picture_file(old_url, oidc_token=oidc_token)

    return APIResponse(data=_user_response(current_user), message="Profile picture updated")


@router.delete("/me/profile-picture")
async def remove_profile_picture(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    old_url = current_user.profile_picture
    if not old_url:
        return APIResponse(data=_user_response(current_user), message="No profile picture to remove")

    current_user.profile_picture = None
    db.commit()
    db.refresh(current_user)
    await _delete_profile_picture_file(old_url, oidc_token=request.headers.get("x-vercel-oidc-token"))
    return APIResponse(data=_user_response(current_user), message="Profile picture removed")


def _user_response(user) -> dict:
    return {
        "id": user.id,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "email": user.email,
        "role": user.role,
        "status": user.status,
        "job_title": user.job_title,
        "phone": user.phone,
        "profile_picture": user.profile_picture,
        "manager_id": user.manager_id,
        "last_login": user.last_login,
        "created_at": user.created_at,
        "departments": [{"id": d.id, "name": d.name} for d in user.departments],
        **notification_preferences_dict(user),
    }
