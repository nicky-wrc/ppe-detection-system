from sqlalchemy.orm import Session

from app.core.config import settings
from app.models import UserSettings, Zone

SAFE_PERSON_CONFIDENCE_MIN = 30
SAFE_PERSON_CONFIDENCE_MAX = 90
SAFE_PPE_SENSITIVITY_MIN = 35
SAFE_PPE_SENSITIVITY_MAX = 75
PPE_LABELS = {
    "helmet": "หมวกนิรภัย",
    "safety-vest": "เสื้อสะท้อนแสง",
}
VIOLATION_LABELS = {
    "no_helmet": "ไม่สวมหมวกนิรภัย",
    "no_hardhat": "ไม่สวมหมวกนิรภัย",
    "no_safety_vest": "ไม่สวมเสื้อสะท้อนแสง",
    "no_vest": "ไม่สวมเสื้อสะท้อนแสง",
}


def clamp_percent(value: int | float | None, minimum: int, maximum: int) -> int | None:
    if value is None:
        return None
    return max(minimum, min(maximum, int(value)))


def normalize_active_ppe_rules(value: dict | None) -> dict[str, bool]:
    if not isinstance(value, dict):
        return {}
    return {key: bool(value.get(key, False)) for key in PPE_LABELS}


def normalize_violation_label(value: str) -> str:
    normalized = (value or "").strip()
    return VIOLATION_LABELS.get(normalized, normalized)


def summarize_detection_settings(
    required_ppe: list[str],
    confidence: float,
    person_confidence: float,
) -> dict[str, str | list[str] | int | bool]:
    labels = [PPE_LABELS[item] for item in required_ppe if item in PPE_LABELS]
    person_percent = round(person_confidence * 100)
    ppe_percent = round(confidence * 100)
    if not labels:
        return {
            "ppe_check_enabled": False,
            "detection_mode": "ตรวจจับบุคคลเท่านั้น",
            "ppe_rules": [],
            "ppe_rules_label": "ไม่มีเงื่อนไข PPE ที่เปิดใช้งาน",
            "confidence_settings": f"ตรวจคนอย่างน้อย {person_percent}%",
            "person_confidence_percent": person_percent,
            "ppe_confidence_percent": ppe_percent,
        }
    return {
        "ppe_check_enabled": True,
        "detection_mode": "ตรวจจับบุคคลและตรวจ PPE",
        "ppe_rules": labels,
        "ppe_rules_label": ", ".join(labels),
        "confidence_settings": f"ตรวจคนอย่างน้อย {person_percent}%, ตรวจ PPE อย่างน้อย {ppe_percent}%",
        "person_confidence_percent": person_percent,
        "ppe_confidence_percent": ppe_percent,
    }


def resolve_detection_preferences(
    db: Session, user_id: int | None, zone_id: int | None,
) -> tuple[list[str], float, float, bool]:
    """Resolve saved preferences; an active zone overrides personal PPE rules.

    Camera callers supply the owner, while upload/frame callers supply the actor.
    Empty zone rules or explicitly disabled personal rules mean no requirements.
    Refresh ORM rows so a running camera observes changes from another session.
    """
    from app.ml.detector import ppe_sensitivity_to_confidence

    required = ["helmet", "safety-vest"]
    confidence = settings.CONFIDENCE_THRESHOLD
    person_confidence = settings.PERSON_CONFIDENCE_THRESHOLD
    save_evidence = True
    if user_id is not None:
        preferences = db.query(UserSettings).populate_existing().filter(
            UserSettings.user_id == user_id,
        ).first()
        if preferences:
            if preferences.confidence_threshold is not None:
                clamped = clamp_percent(
                    preferences.confidence_threshold,
                    SAFE_PERSON_CONFIDENCE_MIN,
                    SAFE_PERSON_CONFIDENCE_MAX,
                )
                person_confidence = max(0.1, min(0.9, (clamped or SAFE_PERSON_CONFIDENCE_MIN) / 100))
            if preferences.ppe_detection_sensitivity is not None:
                clamped = clamp_percent(
                    preferences.ppe_detection_sensitivity,
                    SAFE_PPE_SENSITIVITY_MIN,
                    SAFE_PPE_SENSITIVITY_MAX,
                )
                confidence = ppe_sensitivity_to_confidence(clamped or SAFE_PPE_SENSITIVITY_MIN)
            if preferences.save_evidence is not None:
                save_evidence = preferences.save_evidence
            if isinstance(preferences.active_ppe_rules, dict):
                active_rules = normalize_active_ppe_rules(preferences.active_ppe_rules)
                required = [item for item in required if active_rules.get(item, False)]

    if zone_id is not None:
        zone = db.query(Zone).populate_existing().filter(
            Zone.id == zone_id, Zone.is_active.is_(True),
        ).first()
        if zone and isinstance(zone.required_ppe, list):
            required = [item for item in zone.required_ppe if item in {"helmet", "safety-vest"}]

    return required, confidence, person_confidence, save_evidence
