import asyncio
import time
from collections.abc import AsyncIterator
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session
from starlette.responses import StreamingResponse

from app.core.database import get_db
from app.core.security import decode_access_token, get_current_user, require_roles
from app.models import Camera, User, ViolationLog, Zone
from app.schemas.camera import CameraCreate, CameraDeviceResponse, CameraResponse, CameraTestResponse, CameraUpdate
from app.services.camera_runtime import camera_runtime, discover_local_camera_sources, test_camera_source

router = APIRouter()
MJPEG_BOUNDARY = "ppeframe"
CAMERA_STOP_TIMEOUT_SECONDS = 2.0


async def _run_camera_probe(function, *args):
    return await asyncio.to_thread(function, *args)


def _camera_query(db: Session, current_user: User):
    return db.query(Camera)


def _get_camera_or_404(db: Session, camera_id: int, current_user: User) -> Camera:
    camera = _camera_query(db, current_user).filter(Camera.id == camera_id).first()
    if camera is None:
        raise HTTPException(status_code=404, detail="Camera not found")
    return camera


def _require_preview_user(token: str, db: Session) -> User:
    user = decode_access_token(token, db)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Could not validate credentials")
    if user.role not in {"admin", "safety_officer"}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission to view previews")
    return user


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


@router.get("/devices", response_model=List[CameraDeviceResponse])
async def list_camera_devices(
    current_user: User = Depends(require_roles("admin")),
):
    return await _run_camera_probe(discover_local_camera_sources)


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
    """Return the latest authorized in-memory camera frame without persisting it."""
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


async def _preview_stream(camera_id: int) -> AsyncIterator[bytes]:
    last_captured_at = -1.0
    interval = 1 / 12
    while True:
        preview = camera_runtime.get_preview(camera_id)
        if preview is None:
            await asyncio.sleep(interval)
            continue
        content, captured_at = preview
        if captured_at <= last_captured_at:
            await asyncio.sleep(interval)
            continue
        last_captured_at = captured_at
        yield (
            f"--{MJPEG_BOUNDARY}\r\n"
            "Content-Type: image/jpeg\r\n"
            f"Content-Length: {len(content)}\r\n"
            f"X-Preview-Captured-At: {captured_at}\r\n"
            "\r\n"
        ).encode("ascii") + content + b"\r\n"
        elapsed = max(0.0, time.time() - captured_at)
        await asyncio.sleep(max(0.0, interval - elapsed))


@router.get("/{camera_id}/preview-stream")
async def stream_camera_preview(
    camera_id: int,
    token: str = Query(min_length=1),
    db: Session = Depends(get_db),
):
    """Stream authorized in-memory preview frames over one MJPEG response."""
    current_user = _require_preview_user(token, db)
    _get_camera_or_404(db, camera_id, current_user)
    return StreamingResponse(
        _preview_stream(camera_id),
        media_type=f"multipart/x-mixed-replace; boundary={MJPEG_BOUNDARY}",
        headers={
            "Cache-Control": "no-store, no-cache, must-revalidate",
            "Pragma": "no-cache",
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
    camera.is_active = False
    camera.is_online = False
    camera.last_error = None
    db.commit()
    try:
        await asyncio.wait_for(camera_runtime.stop(camera.id), timeout=CAMERA_STOP_TIMEOUT_SECONDS)
    except asyncio.TimeoutError:
        # Do not block deletion if a native camera driver is slow to release.
        pass
    db.query(ViolationLog).filter(ViolationLog.camera_id == camera.id).update(
        {ViolationLog.camera_id: None},
        synchronize_session=False,
    )
    db.delete(camera)
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
    return await _run_camera_probe(test_camera_source, camera)


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
    camera.is_online = False
    camera.last_error = None
    db.commit()
    await camera_runtime.stop(camera.id)
    db.refresh(camera)
    return _response(camera)
