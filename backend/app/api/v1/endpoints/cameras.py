import asyncio
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user, require_roles
from app.models import Camera, User, Zone
from app.schemas.camera import CameraCreate, CameraResponse, CameraTestResponse, CameraUpdate
from app.services.camera_runtime import camera_runtime, test_camera_source

router = APIRouter()


def _camera_query(db: Session, current_user: User):
    return db.query(Camera)


def _get_camera_or_404(db: Session, camera_id: int, current_user: User) -> Camera:
    camera = _camera_query(db, current_user).filter(Camera.id == camera_id).first()
    if camera is None:
        raise HTTPException(status_code=404, detail="Camera not found")
    return camera


def _response(camera: Camera) -> CameraResponse:
    data = CameraResponse.model_validate(camera)
    # Never return stream credentials to the browser after creation.
    if data.source_type == "rtsp":
        data.rtsp_url = None
    return data


@router.get("/", response_model=List[CameraResponse])
async def list_cameras(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return [_response(camera) for camera in _camera_query(db, current_user).order_by(Camera.id).all()]


@router.post("/", response_model=CameraResponse, status_code=status.HTTP_201_CREATED)
async def create_camera(
    payload: CameraCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Administrator role required")
    if payload.zone_id is not None:
        zone = db.query(Zone).filter(Zone.id == payload.zone_id, Zone.is_active.is_(True)).first()
        if zone is None:
            raise HTTPException(status_code=400, detail="Active zone not found")
    camera = Camera(owner_id=current_user.id, **payload.model_dump())
    db.add(camera)
    db.commit()
    db.refresh(camera)
    return _response(camera)


@router.get("/{camera_id}", response_model=CameraResponse)
async def get_camera(
    camera_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _response(_get_camera_or_404(db, camera_id, current_user))


@router.get("/{camera_id}/preview", response_class=Response)
async def get_camera_preview(
    camera_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "safety_officer")),
):
    """Return the latest in-memory, privacy-filtered camera frame."""
    _get_camera_or_404(db, camera_id, current_user)
    preview = camera_runtime.get_preview(camera_id)
    if preview is None:
        return Response(
            status_code=status.HTTP_204_NO_CONTENT,
            headers={"Cache-Control": "no-store, no-cache, must-revalidate"},
        )
    content, captured_at = preview
    return Response(
        content=content,
        media_type="image/jpeg",
        headers={
            "Cache-Control": "no-store, no-cache, must-revalidate",
            "Pragma": "no-cache",
            "X-Preview-Captured-At": str(captured_at),
        },
    )


@router.put("/{camera_id}", response_model=CameraResponse)
async def update_camera(
    camera_id: int,
    payload: CameraUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Administrator role required")
    camera = _get_camera_or_404(db, camera_id, current_user)
    if camera_runtime.is_running(camera_id):
        raise HTTPException(status_code=409, detail="Stop the camera before changing its configuration")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(camera, key, value)
    db.commit()
    db.refresh(camera)
    return _response(camera)


@router.delete("/{camera_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_camera(
    camera_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Administrator role required")
    camera = _get_camera_or_404(db, camera_id, current_user)
    await camera_runtime.stop(camera.id)
    camera.is_active = False
    db.commit()
    return None


@router.post("/{camera_id}/test", response_model=CameraTestResponse)
async def test_camera(
    camera_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Administrator role required")
    camera = _get_camera_or_404(db, camera_id, current_user)
    return await asyncio.to_thread(test_camera_source, camera)


@router.post("/{camera_id}/start", response_model=CameraResponse)
async def start_camera(
    camera_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Administrator role required")
    camera = _get_camera_or_404(db, camera_id, current_user)
    camera.is_active = True
    camera.last_error = None
    db.commit()
    await camera_runtime.start(camera.id)
    db.refresh(camera)
    return _response(camera)


@router.post("/{camera_id}/stop", response_model=CameraResponse)
async def stop_camera(
    camera_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Administrator role required")
    camera = _get_camera_or_404(db, camera_id, current_user)
    camera.is_active = False
    db.commit()
    await camera_runtime.stop(camera.id)
    db.refresh(camera)
    return _response(camera)
