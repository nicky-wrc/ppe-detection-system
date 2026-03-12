from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import get_current_user
from app.models import User, Detection
from app.schemas import DetectionResponse, DetectionStats
from app.services import DetectionService

router = APIRouter()


@router.post("/image", response_model=DetectionResponse)
async def detect_from_image(
    file: UploadFile = File(...),
    zone_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """อัปโหลดรูปภาพเพื่อตรวจจับ PPE"""
    if not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ไฟล์ต้องเป็นรูปภาพเท่านั้น"
        )
    
    service = DetectionService(db)
    
    try:
        detection = await service.process_image(
            file=file,
            user_id=current_user.id,
            zone_id=zone_id
        )
        return detection
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"เกิดข้อผิดพลาด: {str(e)}"
        )

@router.post("/video", response_model=DetectionResponse)
async def detect_from_video(
    file: UploadFile = File(...),
    zone_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """อัปโหลดวิดีโอเพื่อตรวจจับ PPE"""
    if not file.content_type.startswith("video/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ไฟล์ต้องเป็นวิดีโอเท่านั้น"
        )
    
    service = DetectionService(db)
    
    try:
        detection = await service.process_video(
            file=file,
            user_id=current_user.id,
            zone_id=zone_id
        )
        return detection
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
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """ดูสถิติรายวัน"""
    service = DetectionService(db)
    return service.get_daily_analytics(days=days)


@router.get("/{detection_id}/image/result")
async def get_result_image(
    detection_id: int,
    db: Session = Depends(get_db)
):
    """ดูรูปภาพผลการตรวจจับ"""
    detection = db.query(Detection).filter(Detection.id == detection_id).first()
    
    if detection is None or detection.result_image_path is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="ไม่พบรูปภาพ"
        )
    
    return FileResponse(detection.result_image_path)


@router.get("/{detection_id}/video/result")
async def get_result_video(
    detection_id: int,
    db: Session = Depends(get_db)
):
    """ดูวิดีโอผลการตรวจจับ"""
    detection = db.query(Detection).filter(Detection.id == detection_id).first()
    
    if detection is None or detection.result_image_path is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="ไม่พบสื่อข้อมูล"
        )
    
    import os
    path = detection.result_image_path
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
