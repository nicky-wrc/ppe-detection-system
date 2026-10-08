import asyncio
import threading
import uuid
import cv2
import aiofiles
import numpy as np
from pathlib import Path
from typing import Any, Optional, List, Tuple
from datetime import datetime, timezone
from zoneinfo import ZoneInfo
from sqlalchemy.orm import Session
from sqlalchemy import func, cast, Date, String, and_, or_
from datetime import timedelta, date as date_type
from fastapi import UploadFile
from app.core.config import settings
from app.models import Detection, Alert
from app.ml.detector import get_detector
from app.services.detection_preferences import (
    get_detection_record_mode,
    get_detection_cooldown,
    normalize_violation_label,
    resolve_detection_preferences,
    should_save_detection_record,
    summarize_detection_settings,
)
from app.services.websocket_manager import ws_manager


frame_inference_lock = threading.Lock()


class DetectionService:
    def __init__(self, db: Session):
        self.db = db
        self.detector = get_detector()
        self.upload_dir = Path(settings.UPLOAD_DIR)
        self.upload_dir.mkdir(parents=True, exist_ok=True)

    async def save_upload_file(self, file: UploadFile) -> str:
        ext = Path(file.filename or "upload.bin").suffix.lower()
        filename = f"{uuid.uuid4()}{ext}"
        filepath = self.upload_dir / filename

        total = 0
        async with aiofiles.open(filepath, "wb") as f:
            while chunk := await file.read(1024 * 1024):
                total += len(chunk)
                if total > settings.MAX_FILE_SIZE:
                    await f.close()
                    filepath.unlink(missing_ok=True)
                    raise ValueError(f"ไฟล์มีขนาดเกิน {settings.MAX_FILE_SIZE // (1024 * 1024)} MB")
                await f.write(chunk)
        
        return str(filepath)

    def _get_detection_options(
        self,
        user_id: Optional[int],
        zone_id: Optional[int],
    ) -> tuple[list[str], float, float]:
        required_ppe, confidence, person_confidence, _ = resolve_detection_preferences(
            self.db, user_id, zone_id,
        )
        return required_ppe, confidence, person_confidence

    def _settings_summary(
        self, user_id: Optional[int], required_ppe: list[str], confidence: float, person_confidence: float,
    ) -> dict:
        return summarize_detection_settings(
            required_ppe, confidence, person_confidence, get_detection_record_mode(self.db, user_id),
        )

    def _summary_with_settings(self, detection_result: dict, settings_summary: dict) -> dict:
        return {
            **(detection_result.get("summary", {}) or {}),
            "settings": settings_summary,
            "runtime": {
                "environment": settings.ENVIRONMENT,
                "model_version": settings.MODEL_VERSION,
                **self.detector.engine_metadata,
            },
        }

    def _allows_detection_record(self, user_id: Optional[int], has_violation: bool) -> bool:
        return should_save_detection_record(get_detection_record_mode(self.db, user_id), has_violation)

    @staticmethod
    def _violation_flags(violations: Any) -> tuple[bool, bool]:
        values = violations if isinstance(violations, list) else []
        text = " ".join(str(value) for value in values).lower()
        has_helmet_violation = any(token in text for token in ("helmet", "hardhat", "หมวก"))
        has_vest_violation = any(token in text for token in ("vest", "เสื้อ"))
        return has_helmet_violation, has_vest_violation

    async def process_image(
        self,
        file: UploadFile,
        user_id: Optional[int] = None,
        zone_id: Optional[int] = None,
        enforce_record_mode: bool = False,
    ) -> Detection:
        original_path = await self.save_upload_file(file)
        
        result_filename = f"result_{uuid.uuid4()}.jpg"
        result_path = str(self.upload_dir / result_filename)
        
        required_ppe, confidence, person_confidence = self._get_detection_options(user_id, zone_id)
        settings_summary = self._settings_summary(user_id, required_ppe, confidence, person_confidence)

        detection_result = self.detector.process_image(
            original_path,
            result_path,
            required_ppe=required_ppe,
            confidence_threshold=confidence,
            person_confidence=person_confidence,
        )

        has_violation = detection_result.get("has_violation", False)
        if enforce_record_mode and not self._allows_detection_record(user_id, has_violation):
            Path(original_path).unlink(missing_ok=True)
            Path(result_path).unlink(missing_ok=True)
            raise ValueError("Detection record type is disabled by user settings")
        
        detection = Detection(
            user_id=user_id,
            zone_id=zone_id,
            original_image_path=original_path,
            result_image_path=result_path,
            detected_objects=detection_result.get("detected_objects", []),
            persons=detection_result.get("persons", []),
            violations=[normalize_violation_label(item) for item in detection_result.get("violations", [])],
            person_count=detection_result.get("person_count", 0),
            violation_count=detection_result.get("violation_count", 0),
            has_violation=has_violation,
            processing_time_ms=detection_result.get("processing_time_ms", 0),
            summary=self._summary_with_settings(detection_result, settings_summary)
        )
        
        self.db.add(detection)
        self.db.commit()
        self.db.refresh(detection)
        
        if detection.has_violation:
            await self._create_alerts(detection)
        
        return detection

    async def process_frame(
        self,
        file: UploadFile,
        zone_id: Optional[int] = None,
        user_id: Optional[int] = None,
        recording_consent: bool = False,
        browser_performance: Optional[dict] = None,
    ) -> dict:
        content = await file.read(settings.MAX_FRAME_SIZE + 1)
        if len(content) > settings.MAX_FRAME_SIZE:
            raise ValueError(f"เฟรมมีขนาดเกิน {settings.MAX_FRAME_SIZE // (1024 * 1024)} MB")
        image_array = np.frombuffer(content, dtype=np.uint8)
        image = cv2.imdecode(image_array, cv2.IMREAD_COLOR)
        if image is None:
            raise ValueError("ไม่สามารถอ่านเฟรมจากกล้องได้")

        required_ppe, confidence, person_confidence = self._get_detection_options(user_id, zone_id)
        settings_summary = self._settings_summary(user_id, required_ppe, confidence, person_confidence)

        # CPU inference must not block /ready, authentication or other API work.
        # Keep the shared model serialized even outside the demo middleware.
        def infer_frame():
            with frame_inference_lock:
                return self.detector.detect(
                    image,
                    required_ppe=required_ppe,
                    confidence_threshold=confidence,
                    person_confidence=person_confidence,
                )

        inference = asyncio.create_task(asyncio.to_thread(infer_frame))
        try:
            detection_result = await asyncio.shield(inference)
        except asyncio.CancelledError:
            # A thread cannot be cancelled: retain the demo's request lock until
            # it finishes, so disconnects cannot launch overlapping inference.
            try:
                await inference
            finally:
                raise

        response = {
            "id": 0,
            "zone_id": zone_id,
            "original_image_path": "live-camera-frame",
            "result_image_path": None,
            "detected_objects": detection_result.get("detected_objects", []),
            "persons": detection_result.get("persons", []),
            "violations": [normalize_violation_label(item) for item in detection_result.get("violations", [])],
            "person_count": detection_result.get("person_count", 0),
            "violation_count": detection_result.get("violation_count", 0),
            "has_violation": detection_result.get("has_violation", False),
            "processing_time_ms": detection_result.get("processing_time_ms", 0),
            "summary": self._summary_with_settings(detection_result, settings_summary),
            "created_at": datetime.now(),
        }
        if browser_performance is not None:
            response["summary"]["browser_performance"] = browser_performance
        if settings.ENVIRONMENT == "research_demo" and settings.CLOUD_BROWSER_RECORDING and recording_consent:
            response["summary"]["cloud_recording_enabled"] = True
            if response["person_count"] > 0 and self._allows_detection_record(user_id, response["has_violation"]):
                cutoff = datetime.now(timezone.utc) - timedelta(seconds=get_detection_cooldown(self.db, user_id))
                recent = self.db.query(Detection).filter(
                    Detection.user_id == user_id, Detection.zone_id == zone_id,
                    Detection.original_image_path == "cloud-browser-frame",
                    Detection.has_violation == response["has_violation"],
                    Detection.created_at >= cutoff,
                ).first()
                if recent is None:
                    await self._persist_cloud_frame(image, detection_result, response, user_id)
        return response

    async def _persist_cloud_frame(self, image: np.ndarray, result: dict, response: dict, user_id: Optional[int]) -> None:
        from app.services.cloud_evidence import get_cloud_evidence_store, CloudEvidenceError
        from app.services.evidence_recorder import blur_person_heads, EvidenceRecorder

        _, _, _, save_evidence = resolve_detection_preferences(self.db, user_id, response["zone_id"])
        evidence_path = None
        if save_evidence:
            def encode_evidence():
                blurred = blur_person_heads(image, result.get("persons", []))
                annotated = self.detector.draw_detections(blurred, result)
                return EvidenceRecorder.encode(annotated)
            encoded = await asyncio.to_thread(encode_evidence)
            if encoded is None:
                raise CloudEvidenceError("Evidence encoding failed")
            evidence_path = await get_cloud_evidence_store().upload(encoded)
        record = Detection(
            user_id=user_id, zone_id=response["zone_id"], original_image_path="cloud-browser-frame",
            result_image_path=evidence_path, detected_objects=response["detected_objects"],
            persons=response["persons"], violations=response["violations"], person_count=response["person_count"],
            violation_count=response["violation_count"], has_violation=response["has_violation"],
            processing_time_ms=response["processing_time_ms"], summary=response["summary"],
        )
        try:
            self.db.add(record)
            self.db.flush()
            if record.has_violation:
                await self._create_alerts(record)
            else:
                self.db.commit()
            self.db.refresh(record)
        except Exception:
            self.db.rollback()
            raise
        response["id"] = record.id
        response["original_image_path"] = record.original_image_path
        response["result_image_path"] = evidence_path
        response["created_at"] = record.created_at

    async def process_compliant_frame_report(
        self,
        file: UploadFile,
        user_id: Optional[int] = None,
        zone_id: Optional[int] = None,
    ) -> Detection:
        if not self._allows_detection_record(user_id, False):
            raise ValueError("Detection record type is disabled by user settings")

        original_path = await self.save_upload_file(file)

        result_filename = f"result_{uuid.uuid4()}.jpg"
        result_path = str(self.upload_dir / result_filename)

        required_ppe, confidence, person_confidence = self._get_detection_options(user_id, zone_id)
        settings_summary = self._settings_summary(user_id, required_ppe, confidence, person_confidence)

        detection_result = self.detector.process_image(
            original_path,
            result_path,
            required_ppe=required_ppe,
            confidence_threshold=confidence,
            person_confidence=person_confidence,
        )

        if detection_result.get("has_violation", False) or detection_result.get("person_count", 0) <= 0:
            Path(original_path).unlink(missing_ok=True)
            Path(result_path).unlink(missing_ok=True)
            raise ValueError("เฟรมนี้ยังไม่ใช่รายการที่ตรวจพบคนโดยไม่มีการละเมิด")

        ppe_check_enabled = bool(settings_summary.get("ppe_check_enabled"))
        summary = self._summary_with_settings(detection_result, settings_summary)
        if ppe_check_enabled:
            summary = {
                **summary,
                "status": "compliant",
                "message": "ตรวจพบการสวมใส่ครบถ้วน",
            }
        else:
            summary = {
                **summary,
                "status": "person_only",
                "message": "ตรวจพบบุคคล โดยปิดการตรวจเงื่อนไข PPE",
            }

        detection = Detection(
            user_id=user_id,
            zone_id=zone_id,
            original_image_path=original_path,
            result_image_path=result_path,
            detected_objects=detection_result.get("detected_objects", []),
            persons=detection_result.get("persons", []),
            violations=[],
            person_count=detection_result.get("person_count", 0),
            violation_count=0,
            has_violation=False,
            processing_time_ms=detection_result.get("processing_time_ms", 0),
            summary=summary,
        )

        self.db.add(detection)
        self.db.commit()
        self.db.refresh(detection)

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
        
        required_ppe, confidence, person_confidence = self._get_detection_options(user_id, zone_id)
        settings_summary = self._settings_summary(user_id, required_ppe, confidence, person_confidence)

        detection_result = self.detector.process_video(
            original_path,
            result_path,
            required_ppe=required_ppe,
            confidence_threshold=confidence,
            person_confidence=person_confidence,
        )
        
        actual_video_path = detection_result.get("output_video_path", result_path)
        best_frame_path = detection_result.get("best_frame_path")
        
        detection = Detection(
            user_id=user_id,
            zone_id=zone_id,
            original_image_path=original_path,
            result_image_path=best_frame_path,
            result_video_path=actual_video_path,
            detected_objects=detection_result.get("detected_objects", []),
            persons=detection_result.get("persons", []),
            violations=[normalize_violation_label(item) for item in detection_result.get("violations", [])],
            person_count=detection_result.get("person_count", 0),
            violation_count=detection_result.get("violation_count", 0),
            has_violation=detection_result.get("has_violation", False),
            processing_time_ms=detection_result.get("processing_time_ms", 0),
            summary=self._summary_with_settings(detection_result, settings_summary)
        )
        
        self.db.add(detection)
        self.db.commit()
        self.db.refresh(detection)
        
        if detection.has_violation:
            await self._create_alerts(detection)
        
        return detection

    async def _create_alerts(self, detection: Detection) -> None:
        alerts: list[Alert] = []
        for violation in detection.violations:
            alert = Alert(
                detection_id=detection.id,
                alert_type=violation,
                message=f"ตรวจพบ: {violation}"
            )
            self.db.add(alert)
            alerts.append(alert)
        self.db.commit()

        for alert in alerts:
            self.db.refresh(alert)
            await ws_manager.broadcast_alert(
                {
                    "alert_id": alert.id,
                    "detection_id": detection.id,
                    "camera_name": "Detection",
                    "violation_type": alert.alert_type,
                    "created_at": (alert.created_at or datetime.now()).isoformat(),
                },
            )

    def get_detection(self, detection_id: int) -> Optional[Detection]:
        """Return a detection from the organization-wide shared dataset."""
        return self.db.query(Detection).filter(Detection.id == detection_id).first()

    def get_detections(
        self,
        skip: int = 0,
        limit: int = 20,
        zone_id: Optional[int] = None,
        has_violation: Optional[bool] = None,
        start_date: Optional[date_type] = None,
        end_date: Optional[date_type] = None,
        missing_ppe: Optional[str] = None,
        detected_ppe: Optional[str] = None,
    ) -> Tuple[List[Detection], int]:
        """Return shared detection history; account ownership never scopes reads."""
        query = self.db.query(Detection)
        order_by_clauses = [Detection.created_at.desc()]

        if zone_id is not None:
            query = query.filter(Detection.zone_id == zone_id)
        
        if has_violation is not None:
            query = query.filter(Detection.has_violation == has_violation)

        if start_date is not None:
            query = query.filter(Detection.created_at >= datetime.combine(start_date, datetime.min.time()))

        if end_date is not None:
            next_day = datetime.combine(end_date + timedelta(days=1), datetime.min.time())
            query = query.filter(Detection.created_at < next_day)

        if missing_ppe is not None:
            candidates = query.all()

            def matches_missing(detection: Detection) -> bool:
                has_helmet_violation, has_vest_violation = self._violation_flags(detection.violations)
                if missing_ppe == "both":
                    return has_helmet_violation and has_vest_violation
                if missing_ppe == "helmet":
                    return has_helmet_violation
                return has_vest_violation

            def missing_priority(detection: Detection) -> int:
                has_helmet_violation, has_vest_violation = self._violation_flags(detection.violations)
                if missing_ppe == "helmet":
                    return 0 if has_helmet_violation and not has_vest_violation else 1
                if missing_ppe == "vest":
                    return 0 if has_vest_violation and not has_helmet_violation else 1
                return 0

            filtered = [detection for detection in candidates if matches_missing(detection)]
            filtered.sort(key=lambda detection: detection.created_at.timestamp() if detection.created_at else 0, reverse=True)
            if missing_ppe in {"helmet", "vest"}:
                filtered.sort(key=missing_priority)
            total = len(filtered)
            return filtered[skip:skip + limit], total

        if detected_ppe is not None:
            persons_text = cast(Detection.persons, String)
            summary_text = cast(Detection.summary, String)
            helmet = or_(
                persons_text.ilike('%helmet%'),
                persons_text.ilike('%hardhat%'),
                persons_text.ilike('%หมวก%'),
            )
            vest = or_(
                persons_text.ilike('%safety-vest%'),
                persons_text.ilike('%safety_vest%'),
                persons_text.ilike('%vest%'),
                persons_text.ilike('%เสื้อ%'),
            )
            if detected_ppe == "both":
                query = query.filter(
                    Detection.has_violation.is_(False),
                    or_(Detection.summary.is_(None), ~summary_text.ilike('%person_only%')),
                )
            query = query.filter(and_(helmet, vest) if detected_ppe == 'both' else helmet if detected_ppe == 'helmet' else vest)
        
        total = query.count()
        detections = query.order_by(*order_by_clauses).offset(skip).limit(limit).all()
        
        return detections, total

    def get_stats(self, zone_id: Optional[int] = None) -> dict:
        """Aggregate organization-wide statistics for every authenticated role."""
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

    def get_daily_analytics(
        self,
        days: int = 7,
        start_date: Optional[date_type] = None,
        end_date: Optional[date_type] = None,
    ) -> dict:
        """Get daily/hourly analytics for charts.

        - If start_date/end_date provided: use that inclusive range (max 30 days).
        - Else: use last N days (days).
        - hourly is only meaningful when range is a single day.
        """
        analytics_tz = ZoneInfo("Asia/Bangkok")
        now = datetime.now(analytics_tz)
        if start_date and end_date:
            if end_date < start_date:
                start_date, end_date = end_date, start_date
            range_days = (end_date - start_date).days + 1
            range_days = max(1, min(range_days, 30))
            start_dt = datetime.combine(start_date, datetime.min.time(), tzinfo=analytics_tz)
            end_dt = datetime.combine(end_date, datetime.max.time(), tzinfo=analytics_tz)
            # Ensure range is not above 30 days even if user passes longer
            if range_days > 30:
                end_dt = start_dt + timedelta(days=29, hours=23, minutes=59, seconds=59, microseconds=999999)
        else:
            range_days = days
            # Include "today" in the last N-day window.
            end_dt = now
            start_dt = datetime.combine((end_dt - timedelta(days=range_days - 1)).date(), datetime.min.time(), tzinfo=analytics_tz)
        
        # Get daily stats
        daily_data = []
        for i in range(range_days):
            d = (start_dt + timedelta(days=i)).date()
            date_start = datetime.combine(d, datetime.min.time(), tzinfo=analytics_tz)
            date_end = datetime.combine(d, datetime.max.time(), tzinfo=analytics_tz)
            
            query = self.db.query(Detection).filter(
                Detection.created_at >= date_start,
                Detection.created_at <= date_end
            )
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
                hour_start = day_start + timedelta(hours=hour)
                hour_end = hour_start + timedelta(hours=1, microseconds=-1)

                q = self.db.query(Detection).filter(
                    Detection.created_at >= hour_start,
                    Detection.created_at <= hour_end
                )
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
                "days": range_days,
                "timezone": "Asia/Bangkok"
            }
        }
