from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.database import get_db
from app.repositories.base import user_to_dict
from app.schemas.common import APIResponse
from app.schemas.user import OtpRequest, OtpVerify, RefreshRequest, TokenResponse, UserResponse
from app.services.auth_service import AuthService
from app.services.notification_service import notification_preferences_dict

router = APIRouter(prefix="/auth", tags=["auth"])


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
