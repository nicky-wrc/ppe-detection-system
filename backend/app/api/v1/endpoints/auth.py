import asyncio
import logging
from datetime import datetime, timezone, timedelta
import hashlib
import secrets
from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.config import settings
from app.core.security import verify_password, get_password_hash, create_access_token, get_current_user
from app.models import User
from app.schemas import UserCreate, UserResponse, Token, ForgotPasswordRequest, ForgotPasswordConfirmRequest
from app.core.rate_limit import enforce_rate_limit
from app.services.email_notifier import email_notifier

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/login", response_model=Token)
async def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    enforce_rate_limit(request, "login", limit=5)
    user = db.query(User).filter(User.email == form_data.username).first()
    
    if not user or not user.is_active or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="อีเมลหรือรหัสผ่านไม่ถูกต้อง",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token = create_access_token(data={"sub": str(user.id)})
    return Token(access_token=access_token)


@router.post("/register", response_model=UserResponse)
async def register(
    request: Request,
    user_data: UserCreate,
    db: Session = Depends(get_db)
):
    enforce_rate_limit(request, "register", limit=5)
    if not settings.ALLOW_PUBLIC_REGISTRATION:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Public registration is disabled")
    existing_user = db.query(User).filter(User.email == user_data.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="อีเมลนี้ถูกใช้งานแล้ว"
        )
    
    user = User(
        email=user_data.email,
        hashed_password=get_password_hash(user_data.password),
        full_name=user_data.full_name,
        role="viewer"
    )
    
    db.add(user)
    db.commit()
    db.refresh(user)
    
    return user


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/forgot-password")
async def forgot_password_request(
    request: Request,
    payload: ForgotPasswordRequest,
    db: Session = Depends(get_db)
):
    enforce_rate_limit(request, "forgot-password", limit=5)
    user = db.query(User).filter(User.email == payload.email).first()
    # Always return generic message to avoid user enumeration.
    if not user:
        return {"message": "หากอีเมลมีอยู่ในระบบ ระบบได้ส่งรหัสรีเซ็ตรหัสผ่านแล้ว"}

    raw_token = secrets.token_urlsafe(8)
    token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
    user.reset_token_hash = token_hash
    user.reset_token_expires_at = datetime.now(timezone.utc) + timedelta(minutes=15)
    db.commit()

    # TODO: In production, send this via email provider.
    # For now, print to server log only (not returned to frontend).
    if settings.ENVIRONMENT != "production":
        print(f"[SECURITY] Password reset token for {user.email}: {raw_token}")
    elif settings.SMTP_HOST and settings.SMTP_FROM_EMAIL:
        try:
            await asyncio.to_thread(email_notifier.send_password_reset, user.email, raw_token)
        except Exception:
            # Keep the public response generic; operational logs show SMTP failure.
            logger.exception("Password reset email delivery failed")
    return {"message": "หากอีเมลมีอยู่ในระบบ ระบบได้ส่งรหัสรีเซ็ตรหัสผ่านแล้ว"}


@router.post("/forgot-password/confirm")
async def forgot_password_confirm(
    request: Request,
    payload: ForgotPasswordConfirmRequest,
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not user.reset_token_hash or not user.reset_token_expires_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ข้อมูลรีเซ็ตรหัสผ่านไม่ถูกต้อง"
        )

    if user.reset_token_expires_at < datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="รหัสรีเซ็ตหมดอายุแล้ว กรุณาขอรหัสใหม่"
        )

    incoming_hash = hashlib.sha256(payload.token.encode("utf-8")).hexdigest()
    if not secrets.compare_digest(incoming_hash, user.reset_token_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="รหัสยืนยันไม่ถูกต้อง"
        )

    user.hashed_password = get_password_hash(payload.new_password)
    user.reset_token_hash = None
    user.reset_token_expires_at = None
    db.commit()
    return {"message": "เปลี่ยนรหัสผ่านเรียบร้อยแล้ว"}


@router.post("/init-admin", response_model=UserResponse)
async def init_admin(
    db: Session = Depends(get_db),
    x_bootstrap_token: str | None = Header(default=None),
):
    enforce_rate_limit(request, "forgot-password-confirm", limit=10)
    if not settings.BOOTSTRAP_TOKEN or not secrets.compare_digest(
        x_bootstrap_token or "", settings.BOOTSTRAP_TOKEN
    ):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Bootstrap is disabled or token is invalid")
    admin_exists = db.query(User).filter(User.role == "admin").first()
    if admin_exists:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Admin มีอยู่แล้ว"
        )
    
    admin = User(
        email=settings.BOOTSTRAP_ADMIN_EMAIL or "admin@ppe-system.local",
        hashed_password=get_password_hash(settings.BOOTSTRAP_ADMIN_PASSWORD or secrets.token_urlsafe(24)),
        full_name="System Admin",
        role="admin"
    )
    
    db.add(admin)
    db.commit()
    db.refresh(admin)
    
    return admin
