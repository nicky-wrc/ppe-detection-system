import uuid
import cv2
import aiofiles
from pathlib import Path
from typing import Optional, List, Tuple
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import func, cast, Date
from datetime import timedelta, date as date_type
from fastapi import UploadFile
from app.core.config import settings
from app.models import Detection, Alert, Zone
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
        
        required_ppe: list[str] | None = None
        if zone_id is not None:
            zone = self.db.query(Zone).filter(Zone.id == zone_id).first()
            if zone and isinstance(zone.required_ppe, list) and len(zone.required_ppe) > 0:
                required_ppe = zone.required_ppe

        detection_result = self.detector.process_image(original_path, result_path, required_ppe=required_ppe)
        
        detection = Detection(
            user_id=user_id,
            zone_id=zone_id,
            original_image_path=original_path,
            result_image_path=result_path,
            detected_objects=detection_result.get("detected_objects", []),
            persons=detection_result.get("persons", []),
            violations=detection_result.get("violations", []),
            person_count=detection_result.get("person_count", 0),
            violation_count=detection_result.get("violation_count", 0),
            has_violation=detection_result.get("has_violation", False),
            processing_time_ms=detection_result.get("processing_time_ms", 0),
            summary=detection_result.get("summary", {})
        )
        
        self.db.add(detection)
        self.db.commit()
        self.db.refresh(detection)
        
        if detection.has_violation:
            self._create_alerts(detection)
        
        return detection

    async def process_video(
        self,
        file: UploadFile,
        user_id: Optional[int] = None,
        zone_id: Optional[int] = None
    ) -> Detection:
        original_path = await self.save_upload_file(file)
        
        result_filename = f"result_{uuid.uuid4()}.avi"
        result_path = str(self.upload_dir / result_filename)
        
        required_ppe: list[str] | None = None
        if zone_id is not None:
            zone = self.db.query(Zone).filter(Zone.id == zone_id).first()
            if zone and isinstance(zone.required_ppe, list) and len(zone.required_ppe) > 0:
                required_ppe = zone.required_ppe

        detection_result = self.detector.process_video(original_path, result_path, required_ppe=required_ppe)
        
        # ใช้ path จริงที่ detector สร้างขึ้น (อาจเปลี่ยน extension)
        actual_output_path = detection_result.get("output_video_path", result_path)
        
        detection = Detection(
            user_id=user_id,
            zone_id=zone_id,
            original_image_path=original_path,
            result_image_path=actual_output_path,
            detected_objects=detection_result.get("detected_objects", []),
            persons=detection_result.get("persons", []),
            violations=detection_result.get("violations", []),
            person_count=detection_result.get("person_count", 0),
            violation_count=detection_result.get("violation_count", 0),
            has_violation=detection_result.get("has_violation", False),
            processing_time_ms=detection_result.get("processing_time_ms", 0),
            summary=detection_result.get("summary", {})
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

    def get_detection(self, detection_id: int, user_id: Optional[int] = None) -> Optional[Detection]:
        query = self.db.query(Detection).filter(Detection.id == detection_id)
        if user_id is not None:
            query = query.filter(Detection.user_id == user_id)
        return query.first()

    def get_detections(
        self,
        skip: int = 0,
        limit: int = 20,
        user_id: Optional[int] = None,
        zone_id: Optional[int] = None,
        has_violation: Optional[bool] = None
    ) -> Tuple[List[Detection], int]:
        query = self.db.query(Detection)
        if user_id is not None:
            query = query.filter(Detection.user_id == user_id)
        
        if zone_id is not None:
            query = query.filter(Detection.zone_id == zone_id)
        
        if has_violation is not None:
            query = query.filter(Detection.has_violation == has_violation)
        
        total = query.count()
        detections = query.order_by(Detection.created_at.desc()).offset(skip).limit(limit).all()
        
        return detections, total

    def get_stats(self, user_id: Optional[int] = None, zone_id: Optional[int] = None) -> dict:
        query = self.db.query(Detection)
        if user_id is not None:
            query = query.filter(Detection.user_id == user_id)
        
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

    def get_daily_analytics(
        self,
        days: int = 7,
        user_id: Optional[int] = None,
        start_date: Optional[date_type] = None,
        end_date: Optional[date_type] = None,
    ) -> dict:
        """Get daily/hourly analytics for charts.

        - If start_date/end_date provided: use that inclusive range (max 30 days).
        - Else: use last N days (days).
        - hourly is only meaningful when range is a single day.
        """
        now = datetime.now()
        if start_date and end_date:
            if end_date < start_date:
                start_date, end_date = end_date, start_date
            range_days = (end_date - start_date).days + 1
            range_days = max(1, min(range_days, 30))
            start_dt = datetime.combine(start_date, datetime.min.time())
            end_dt = datetime.combine(end_date, datetime.max.time())
            # Ensure range is not above 30 days even if user passes longer
            if range_days > 30:
                end_dt = start_dt + timedelta(days=29, hours=23, minutes=59, seconds=59, microseconds=999999)
        else:
            range_days = days
            # Include "today" in the last N-day window.
            end_dt = now
            start_dt = datetime.combine((end_dt - timedelta(days=range_days - 1)).date(), datetime.min.time())
        
        # Get daily stats
        daily_data = []
        for i in range(range_days):
            d = (start_dt + timedelta(days=i)).date()
            date_start = datetime.combine(d, datetime.min.time())
            date_end = datetime.combine(d, datetime.max.time())
            
            query = self.db.query(Detection).filter(
                Detection.created_at >= date_start,
                Detection.created_at <= date_end
            )
            if user_id is not None:
                query = query.filter(Detection.user_id == user_id)
            
            detections_count = query.count()
            stats = query.with_entities(
                func.coalesce(func.sum(Detection.person_count), 0).label("persons"),
                func.coalesce(func.sum(Detection.violation_count), 0).label("violations")
            ).first()
            
            persons = int(stats.persons) if stats.persons else 0
            violations = int(stats.violations) if stats.violations else 0
            # Use 0 when there are no detected persons to avoid misleading 100% flat lines.
            compliance = 0 if persons == 0 else round(((persons - violations) / persons) * 100)
            
            daily_data.append({
                "date": d.strftime("%Y-%m-%d"),
                "day": d.strftime("%a"),
                "detections": detections_count,
                "persons": persons,
                "violations": violations,
                "compliance": compliance
            })
        
        # Hourly distribution (only when single-day range)
        hourly_data = []
        if range_days == 1:
            day_start = start_dt.replace(hour=0, minute=0, second=0, microsecond=0)
            for hour in range(24):
                hour_start = day_start.replace(hour=hour)
                hour_end = day_start.replace(hour=hour, minute=59, second=59, microsecond=999999)

                q = self.db.query(Detection).filter(
                    Detection.created_at >= hour_start,
                    Detection.created_at <= hour_end
                )
                if user_id is not None:
                    q = q.filter(Detection.user_id == user_id)

                detections_count = q.count()
                stats = q.with_entities(
                    func.coalesce(func.sum(Detection.person_count), 0).label("persons"),
                    func.coalesce(func.sum(Detection.violation_count), 0).label("violations")
                ).first()

                persons = int(stats.persons) if stats and stats.persons else 0
                violations = int(stats.violations) if stats and stats.violations else 0
                # Use 0 when there are no detected persons to avoid misleading 100% flat lines.
                compliance = 0 if persons == 0 else round(((persons - violations) / persons) * 100)

                hourly_data.append({
                    "hour": f"{hour:02d}:00",
                    "detections": detections_count,
                    "count": detections_count,  # backward compatibility
                    "persons": persons,
                    "violations": violations,
                    "compliance": compliance
                })
        
        return {
            "daily": daily_data,
            "hourly": hourly_data,
            "period": {
                "start": start_dt.strftime("%Y-%m-%d"),
                "end": end_dt.strftime("%Y-%m-%d"),
                "days": range_days
            }
        }