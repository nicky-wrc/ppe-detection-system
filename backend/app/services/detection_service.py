import uuid
import cv2
import aiofiles
from pathlib import Path
from typing import Optional, List, Tuple
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import func
from fastapi import UploadFile
from app.core.config import settings
from app.models import Detection, Alert
from app.ml.detector import get_detector


class DetectionService:
    def __init__(self, db: Session):
        self.db = db
        self.detector = get_detector()
        self.upload_dir = Path(settings.UPLOAD_DIR)
        self.upload_dir.mkdir(parents=True, exist_ok=True)

    async def save_upload_file(self, file: UploadFile) -> str:
        ext = Path(file.filename).suffix
        filename = f"{uuid.uuid4()}{ext}"
        filepath = self.upload_dir / filename
        
        async with aiofiles.open(filepath, "wb") as f:
            content = await file.read()
            await f.write(content)
        
        return str(filepath)

    async def process_image(
        self,
        file: UploadFile,
        user_id: Optional[int] = None,
        zone_id: Optional[int] = None
    ) -> Detection:
        original_path = await self.save_upload_file(file)
        
        result_filename = f"result_{uuid.uuid4()}.jpg"
        result_path = str(self.upload_dir / result_filename)
        
        detection_result = self.detector.process_image(original_path, result_path)
        
        detection = Detection(
            user_id=user_id,
            zone_id=zone_id,
            original_image_path=original_path,
            result_image_path=result_path,
            detected_objects=detection_result["detected_objects"],
            violations=detection_result["violations"],
            person_count=detection_result["person_count"],
            violation_count=detection_result["violation_count"],
            has_violation=detection_result["has_violation"],
            processing_time_ms=detection_result["processing_time_ms"]
        )
        
        self.db.add(detection)
        self.db.commit()
        self.db.refresh(detection)
        
        if detection.has_violation:
            self._create_alerts(detection)
        
        return detection

    def _create_alerts(self, detection: Detection):
        for violation in detection.violations:
            alert = Alert(
                detection_id=detection.id,
                alert_type=violation,
                message=f"ตรวจพบ: {violation}"
            )
            self.db.add(alert)
        self.db.commit()

    def get_detection(self, detection_id: int) -> Optional[Detection]:
        return self.db.query(Detection).filter(Detection.id == detection_id).first()

    def get_detections(
        self,
        skip: int = 0,
        limit: int = 20,
        zone_id: Optional[int] = None,
        has_violation: Optional[bool] = None
    ) -> Tuple[List[Detection], int]:
        query = self.db.query(Detection)
        
        if zone_id is not None:
            query = query.filter(Detection.zone_id == zone_id)
        
        if has_violation is not None:
            query = query.filter(Detection.has_violation == has_violation)
        
        total = query.count()
        detections = query.order_by(Detection.created_at.desc()).offset(skip).limit(limit).all()
        
        return detections, total

    def get_stats(self, zone_id: Optional[int] = None) -> dict:
        query = self.db.query(Detection)
        
        if zone_id is not None:
            query = query.filter(Detection.zone_id == zone_id)
        
        total_detections = query.count()
        
        stats = query.with_entities(
            func.sum(Detection.person_count).label("total_persons"),
            func.sum(Detection.violation_count).label("total_violations")
        ).first()
        
        total_persons = stats.total_persons or 0
        total_violations = stats.total_violations or 0
        
        compliance_rate = 0.0
        if total_persons > 0:
            compliance_rate = round(((total_persons - total_violations) / total_persons) * 100, 2)
        
        violation_by_type = {}
        detections = query.all()
        for det in detections:
            for violation in det.violations:
                violation_by_type[violation] = violation_by_type.get(violation, 0) + 1
        
        return {
            "total_detections": total_detections,
            "total_persons": total_persons,
            "total_violations": total_violations,
            "compliance_rate": compliance_rate,
            "violation_by_type": violation_by_type
        }