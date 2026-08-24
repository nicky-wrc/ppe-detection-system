from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models import Alert, User, ViolationLog
from app.schemas.camera import ViolationEventResolve, ViolationEventResponse

router = APIRouter()


def _event_query(db: Session, current_user: User):
    return db.query(ViolationLog)


def _event_or_404(db: Session, event_id: int, current_user: User) -> ViolationLog:
    event = _event_query(db, current_user).filter(ViolationLog.id == event_id).first()
    if event is None:
        raise HTTPException(status_code=404, detail="Violation event not found")
    return event


@router.get("/")
async def list_events(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    camera_id: Optional[int] = None,
    zone_id: Optional[int] = None,
    event_status: Optional[str] = Query(None, alias="status"),
    violation_type: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = _event_query(db, current_user)
    if camera_id is not None:
        query = query.filter(ViolationLog.camera_id == camera_id)
    if zone_id is not None:
        query = query.filter(ViolationLog.zone_id == zone_id)
    if event_status:
        query = query.filter(ViolationLog.status == event_status)
    if violation_type:
        query = query.filter(ViolationLog.violation_type == violation_type)
    total = query.count()
    items = query.order_by(ViolationLog.created_at.desc()).offset((page - 1) * per_page).limit(per_page).all()
    return {
        "items": [ViolationEventResponse.model_validate(item) for item in items],
        "total": total,
        "page": page,
        "per_page": per_page,
        "total_pages": (total + per_page - 1) // per_page,
    }


@router.get("/{event_id}", response_model=ViolationEventResponse)
async def get_event(
    event_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _event_or_404(db, event_id, current_user)


@router.put("/{event_id}/acknowledge", response_model=ViolationEventResponse)
async def acknowledge_event(
    event_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in {"admin", "safety_officer"}:
        raise HTTPException(status_code=403, detail="Safety officer role required")
    event = _event_or_404(db, event_id, current_user)
    event.status = "acknowledged"
    event.acknowledged_by = current_user.id
    event.acknowledged_at = datetime.now(timezone.utc)
    alert = db.query(Alert).filter(Alert.violation_log_id == event.id).first()
    if alert:
        alert.status = "acknowledged"
        alert.acknowledged_by = current_user.id
        alert.acknowledged_at = event.acknowledged_at
    db.commit()
    db.refresh(event)
    return event


@router.put("/{event_id}/resolve", response_model=ViolationEventResponse)
async def resolve_event(
    event_id: int,
    payload: ViolationEventResolve,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in {"admin", "safety_officer"}:
        raise HTTPException(status_code=403, detail="Safety officer role required")
    event = _event_or_404(db, event_id, current_user)
    event.status = "resolved"
    event.resolved_by = current_user.id
    event.resolved_at = datetime.now(timezone.utc)
    event.notes = payload.notes
    alert = db.query(Alert).filter(Alert.violation_log_id == event.id).first()
    if alert:
        alert.status = "resolved"
        alert.resolved_by = current_user.id
        alert.resolved_at = event.resolved_at
        alert.resolution_note = payload.notes
    db.commit()
    db.refresh(event)
    return event


@router.get("/{event_id}/evidence/{kind}")
async def get_event_evidence(
    event_id: int,
    kind: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    event = _event_or_404(db, event_id, current_user)
    if kind == "snapshot":
        path = event.snapshot_path
        media_type = "image/jpeg"
    elif kind == "clip":
        path = event.evidence_clip_path
        media_type = "video/mp4"
    else:
        raise HTTPException(status_code=400, detail="Evidence kind must be snapshot or clip")
    if not path or not Path(path).exists():
        raise HTTPException(status_code=404, detail="Evidence not available")
    return FileResponse(path, media_type=media_type, filename=Path(path).name)
