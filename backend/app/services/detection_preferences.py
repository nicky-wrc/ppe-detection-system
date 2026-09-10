from sqlalchemy.orm import Session

from app.core.config import settings
from app.models import UserSettings, Zone


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
                person_confidence = max(0.1, min(0.9, preferences.confidence_threshold / 100))
            if preferences.ppe_detection_sensitivity is not None:
                confidence = ppe_sensitivity_to_confidence(preferences.ppe_detection_sensitivity)
            if preferences.save_evidence is not None:
                save_evidence = preferences.save_evidence
            if preferences.active_ppe_rules:
                required = [item for item in required if preferences.active_ppe_rules.get(item, False)]

    if zone_id is not None:
        zone = db.query(Zone).populate_existing().filter(
            Zone.id == zone_id, Zone.is_active.is_(True),
        ).first()
        if zone and isinstance(zone.required_ppe, list):
            required = [item for item in zone.required_ppe if item in {"helmet", "safety-vest"}]

    return required, confidence, person_confidence, save_evidence
