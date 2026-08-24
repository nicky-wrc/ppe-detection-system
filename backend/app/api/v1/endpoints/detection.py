from typing import Optional
from datetime import date
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, Request, status, UploadFile, File, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import get_current_user, require_roles
from app.models import User, Detection
from app.schemas import DetectionResponse, DetectionStats
from app.services import DetectionService
from app.core.rate_limit import enforce_rate_limit

router = APIRouter()


def _validate_extension(file: UploadFile, allowed: set[str]) -> None:
    extension = Path(file.filename or "").suffix.lower()
    if extension not in allowed:
        raise HTTPException(status_code=400, detail=f"Unsupported file extension: {extension or 'none'}")


@router.post("/image", response_model=DetectionResponse)
async def detect_from_image(
    request: Request,
    file: UploadFile = File(...),
    zone_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "safety_officer"))
):
    """อัปโหลดรูปภาพเพื่อตรวจจับ PPE"""
    enforce_rate_limit(request, "detect-image", limit=30)
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ไฟล์ต้องเป็นรูปภาพเท่านั้น"
        )
    _validate_extension(file, {".jpg", ".jpeg", ".png", ".webp"})
    
    service = DetectionService(db)
    
    try:
        detection = await service.process_image(
            file=file,
            user_id=current_user.id,
            zone_id=zone_id
        )
        return detection
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"เกิดข้อผิดพลาด: {str(e)}"
        )


@router.post("/frame", response_model=DetectionResponse)
async def detect_from_frame(
    request: Request,
    file: UploadFile = File(...),
    zone_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "safety_officer"))
):
    """ตรวจจับ PPE จากเฟรมกล้องแบบ realtime โดยไม่บันทึกลงประวัติทุกเฟรม"""
    enforce_rate_limit(request, "detect-frame", limit=120)
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="เฟรมต้องเป็นรูปภาพเท่านั้น"
        )
    _validate_extension(file, {".jpg", ".jpeg", ".png", ".webp"})

    service = DetectionService(db)

    try:
        return await service.process_frame(
            file=file,
            zone_id=zone_id,
            user_id=current_user.id,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"เกิดข้อผิดพลาด: {str(e)}"
        )


@router.post("/video", response_model=DetectionResponse)
async def detect_from_video(
    request: Request,
    file: UploadFile = File(...),
    zone_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "safety_officer"))
):
    """อัปโหลดวิดีโอเพื่อตรวจจับ PPE"""
    enforce_rate_limit(request, "detect-video", limit=10)
    if not file.content_type or not file.content_type.startswith("video/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ไฟล์ต้องเป็นวิดีโอเท่านั้น"
        )
    _validate_extension(file, {".mp4", ".avi", ".mov", ".webm", ".mkv"})
    
    service = DetectionService(db)
    
    try:
        detection = await service.process_video(
            file=file,
            user_id=current_user.id,
            zone_id=zone_id
        )
        return detection
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"เกิดข้อผิดพลาด: {str(e)}"
        )


@router.get("/history")
async def get_detection_history(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    zone_id: Optional[int] = Query(None),
    has_violation: Optional[bool] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """ดูประวัติการตรวจจับ"""
    service = DetectionService(db)
    
    skip = (page - 1) * per_page
    detections, total = service.get_detections(
        skip=skip,
        limit=per_page,
        zone_id=zone_id,
        has_violation=has_violation
    )
    
    return {
        "items": [DetectionResponse.model_validate(d) for d in detections],
        "total": total,
        "page": page,
        "per_page": per_page,
        "total_pages": (total + per_page - 1) // per_page
    }


@router.get("/stats", response_model=DetectionStats)
async def get_detection_stats(
    zone_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """ดูสถิติการตรวจจับ"""
    service = DetectionService(db)
    return service.get_stats(zone_id=zone_id)


@router.get("/analytics/daily")
async def get_daily_analytics(
    days: int = Query(7, ge=1, le=30),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """ดูสถิติรายวัน"""
    service = DetectionService(db)
    return service.get_daily_analytics(
        days=days,
        start_date=start_date,
        end_date=end_date
    )


@router.get("/{detection_id}/image/result")
async def get_result_image(
    detection_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """ดูรูปภาพผลการตรวจจับ"""
    import os

    detection = db.query(Detection).filter(Detection.id == detection_id).first()

    if detection is None or detection.result_image_path is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="ไม่พบรูปภาพ"
        )

    path = detection.result_image_path
    if not os.path.exists(path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="ไม่พบไฟล์ผลลัพธ์"
        )

    ext_map = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".webp": "image/webp",
        ".mp4": "video/mp4",
        ".avi": "video/x-msvideo",
        ".webm": "video/webm",
    }
    ext = os.path.splitext(path)[1].lower()
    media_type = ext_map.get(ext, "application/octet-stream")

    return FileResponse(
        path,
        media_type=media_type,
        headers={
            "Content-Disposition": f"inline; filename=result_{detection_id}{ext}",
        },
    )


@router.get("/{detection_id}/video/result")
async def get_result_video(
    detection_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """ดูวิดีโอผลการตรวจจับ"""
    detection = db.query(Detection).filter(Detection.id == detection_id).first()
    
    if detection is None or (detection.result_video_path is None and detection.result_image_path is None):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="ไม่พบสื่อข้อมูล"
        )
    
    import os
    path = detection.result_video_path or detection.result_image_path
    if not os.path.exists(path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="ไม่พบไฟล์ผลลัพธ์"
        )
    
    ext_map = {
        '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
        '.mp4': 'video/mp4', '.avi': 'video/x-msvideo', '.webm': 'video/webm',
    }
    ext = os.path.splitext(path)[1].lower()
    media_type = ext_map.get(ext, 'video/mp4')
    
    return FileResponse(path, media_type=media_type, headers={
        "Accept-Ranges": "bytes",
        "Content-Disposition": f"inline; filename=result_{detection_id}{ext}"
    })


@router.get("/{detection_id}", response_model=DetectionResponse)
async def get_detection(
    detection_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """ดูรายละเอียดการตรวจจับ"""
    service = DetectionService(db)
    detection = service.get_detection(detection_id)
    
    if detection is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="ไม่พบข้อมูล"
        )
    
    return detection
