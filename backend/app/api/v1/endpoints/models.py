from pathlib import Path

from fastapi import APIRouter, Depends

from app.core.config import settings
from app.core.security import get_current_user
from app.models import User

router = APIRouter()


@router.get("/active")
async def active_model(current_user: User = Depends(get_current_user)):
    path = Path(settings.MODEL_PATH)
    if not path.is_absolute():
        path = (Path(__file__).resolve().parents[4] / path).resolve()
    return {
        "version": settings.MODEL_VERSION,
        "filename": path.name,
        "available": path.exists(),
        "license_approved": settings.MODEL_LICENSE_APPROVED,
        "classes": ["person", "helmet", "safety-vest"],
        "confidence_threshold": settings.CONFIDENCE_THRESHOLD,
        "person_confidence_threshold": settings.PERSON_CONFIDENCE_THRESHOLD,
        "temporal": {
            "window_size": settings.TEMPORAL_WINDOW_SIZE,
            "confirm_count": settings.TEMPORAL_CONFIRM_COUNT,
            "clear_count": settings.TEMPORAL_CLEAR_COUNT,
        },
    }
