from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import get_current_user, require_roles
from app.models import SettingsAuditLog, User, UserSettings
from app.schemas.settings import UserSettingsResponse, UserSettingsUpdate
from app.services.detection_preferences import (
    SAFE_PERSON_CONFIDENCE_MAX,
    SAFE_PERSON_CONFIDENCE_MIN,
    SAFE_PPE_SENSITIVITY_MAX,
    SAFE_PPE_SENSITIVITY_MIN,
    clamp_percent,
    normalize_active_ppe_rules,
)

router = APIRouter()


def _get_or_create(db: Session, user_id: int) -> UserSettings:
    s = db.query(UserSettings).filter(UserSettings.user_id == user_id).first()
    if s:
        changed = False
        safe_confidence = clamp_percent(
            s.confidence_threshold,
            SAFE_PERSON_CONFIDENCE_MIN,
            SAFE_PERSON_CONFIDENCE_MAX,
        ) or 45
        if s.confidence_threshold != safe_confidence:
            s.confidence_threshold = safe_confidence
            changed = True
        safe_sensitivity = clamp_percent(
            s.ppe_detection_sensitivity,
            SAFE_PPE_SENSITIVITY_MIN,
            SAFE_PPE_SENSITIVITY_MAX,
        ) or 60
        if s.ppe_detection_sensitivity != safe_sensitivity:
            s.ppe_detection_sensitivity = safe_sensitivity
            changed = True
        normalized_rules = normalize_active_ppe_rules(s.active_ppe_rules)
        if s.active_ppe_rules != normalized_rules:
            s.active_ppe_rules = normalized_rules
            changed = True
        if changed:
            db.commit()
            db.refresh(s)
        return s
    s = UserSettings(
        user_id=user_id,
        active_ppe_rules={"helmet": True, "safety-vest": True},
        confidence_threshold=45,
        ppe_detection_sensitivity=60,
        alert_sound=True,
        save_evidence=True,
    )
    db.add(s)
    db.commit()
    db.refresh(s)
    return s


def _settings_snapshot(settings_row: UserSettings) -> dict:
    return {
        "alert_sound": bool(settings_row.alert_sound),
        "save_evidence": bool(settings_row.save_evidence),
        "confidence_threshold": int(settings_row.confidence_threshold or 45),
        "ppe_detection_sensitivity": int(settings_row.ppe_detection_sensitivity or 60),
        "active_ppe_rules": normalize_active_ppe_rules(settings_row.active_ppe_rules),
    }


def _normalize_update_payload(data: dict) -> dict:
    normalized = dict(data)
    if "confidence_threshold" in normalized:
        normalized["confidence_threshold"] = clamp_percent(
            normalized["confidence_threshold"],
            SAFE_PERSON_CONFIDENCE_MIN,
            SAFE_PERSON_CONFIDENCE_MAX,
        )
    if "ppe_detection_sensitivity" in normalized:
        normalized["ppe_detection_sensitivity"] = clamp_percent(
            normalized["ppe_detection_sensitivity"],
            SAFE_PPE_SENSITIVITY_MIN,
            SAFE_PPE_SENSITIVITY_MAX,
        )
    if "active_ppe_rules" in normalized:
        normalized["active_ppe_rules"] = normalize_active_ppe_rules(normalized["active_ppe_rules"])
    return normalized


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
    current_user: User = Depends(require_roles("admin", "safety_officer")),
):
    s = _get_or_create(db, current_user.id)
    before = _settings_snapshot(s)
    data = _normalize_update_payload(payload.model_dump(exclude_unset=True))
    for k, v in data.items():
        setattr(s, k, v)
    after = _settings_snapshot(s)
    if before != after:
        db.add(SettingsAuditLog(
            user_id=s.user_id,
            changed_by=current_user.id,
            old_values=before,
            new_values=after,
        ))
    db.commit()
    db.refresh(s)
    return s
