from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import get_current_user
from app.models import User, UserSettings
from app.schemas.settings import UserSettingsResponse, UserSettingsUpdate

router = APIRouter()


def _get_or_create(db: Session, user_id: int) -> UserSettings:
    s = db.query(UserSettings).filter(UserSettings.user_id == user_id).first()
    if s:
        return s
    s = UserSettings(
        user_id=user_id,
        active_ppe_rules={"helmet": True, "safety-vest": True},
        confidence_threshold=25,
        ppe_detection_sensitivity=60,
        alert_sound=True,
        save_evidence=True,
    )
    db.add(s)
    db.commit()
    db.refresh(s)
    return s


@router.get("/me", response_model=UserSettingsResponse)
async def get_my_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _get_or_create(db, current_user.id)


@router.put("/me", response_model=UserSettingsResponse)
async def update_my_settings(
    payload: UserSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    s = _get_or_create(db, current_user.id)
    data = payload.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(s, k, v)
    db.commit()
    db.refresh(s)
    return s

