import asyncio
import logging
import time
import uuid
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import cv2
import numpy as np

from app.core.config import settings
from app.core.database import SessionLocal
from app.ml.detector import get_detector, ppe_sensitivity_to_confidence
from app.models import Alert, AlertDelivery, Camera, Detection, UserSettings, ViolationLog, Zone
from app.services.email_notifier import email_notifier
from app.services.evidence_recorder import EvidenceRecorder, blur_person_heads
from app.services.temporal_tracker import ConfirmedViolation, TemporalViolationTracker, bbox_match_score
from app.services.websocket_manager import ws_manager

logger = logging.getLogger(__name__)


def _source_for_camera(camera: Camera) -> int | str:
    if camera.source_type == "usb":
        return int(camera.device_index or 0)
    if camera.source_type in {"rtsp", "file"} and camera.rtsp_url:
        return camera.rtsp_url
    raise ValueError(f"Camera {camera.id} has an invalid source configuration")


def _configure_capture(cap: cv2.VideoCapture, camera: Camera) -> None:
    """Apply low-latency capture settings without assuming RTSP supports USB properties."""

    cap.set(cv2.CAP_PROP_BUFFERSIZE, max(1, settings.CAMERA_CAPTURE_BUFFER_SIZE))
    if camera.source_type != "usb":
        return
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, max(320, settings.CAMERA_CAPTURE_WIDTH))
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, max(240, settings.CAMERA_CAPTURE_HEIGHT))
    cap.set(cv2.CAP_PROP_FPS, max(1.0, settings.CAMERA_CAPTURE_FPS))


def test_camera_source(camera: Camera) -> dict[str, Any]:
    cap = cv2.VideoCapture(_source_for_camera(camera))
    try:
        _configure_capture(cap, camera)
        if not cap.isOpened():
            return {"ok": False, "error": "Could not open camera source"}
        ok, frame = cap.read()
        if not ok or frame is None:
            return {"ok": False, "error": "Camera opened but returned no frame"}
        return {
            "ok": True,
            "width": int(frame.shape[1]),
            "height": int(frame.shape[0]),
            "fps": float(cap.get(cv2.CAP_PROP_FPS) or 0),
        }
    finally:
        cap.release()


class CameraRuntimeManager:
    PREVIEW_MAX_WIDTH = 960
    PREVIEW_JPEG_QUALITY = 80

    def __init__(self):
        self.tasks: dict[int, asyncio.Task] = {}
        self._inference_lock = asyncio.Lock()
        self.detector = None
        self._last_events: dict[tuple[int, int, str], float] = {}
        self._recent_event_boxes: dict[tuple[int, str], list[tuple[float, list[float]]]] = {}
        self._preview_frames: dict[int, tuple[bytes, float]] = {}

    async def start(self, camera_id: int) -> None:
        existing = self.tasks.get(camera_id)
        if existing and not existing.done():
            return
        self._preview_frames.pop(camera_id, None)
        self.tasks[camera_id] = asyncio.create_task(self._run(camera_id), name=f"ppe-camera-{camera_id}")

    async def stop(self, camera_id: int) -> None:
        task = self.tasks.pop(camera_id, None)
        if task and not task.done():
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass
        self._preview_frames.pop(camera_id, None)
        self._set_offline(camera_id)

    async def stop_all(self) -> None:
        for camera_id in list(self.tasks):
            await self.stop(camera_id)

    def is_running(self, camera_id: int) -> bool:
        task = self.tasks.get(camera_id)
        return bool(task and not task.done())

    def get_preview(self, camera_id: int) -> tuple[bytes, float] | None:
        """Return the latest authorized in-memory JPEG without persisting it."""
        return self._preview_frames.get(camera_id)

    def _deduplicate_confirmed_events(
        self,
        camera_id: int,
        events: list[ConfirmedViolation],
        now_monotonic: float,
    ) -> list[ConfirmedViolation]:
        """Suppress duplicate alerts when a detector assigns a new track ID to the same person."""

        accepted: list[ConfirmedViolation] = []
        cooldown = max(1, settings.EVENT_COOLDOWN_SECONDS)
        for event in events:
            track_key = (camera_id, event.track_id, event.violation_type)
            if now_monotonic - self._last_events.get(track_key, float("-inf")) < cooldown:
                continue

            spatial_key = (camera_id, event.violation_type)
            recent = [
                (created_at, bbox)
                for created_at, bbox in self._recent_event_boxes.get(spatial_key, [])
                if now_monotonic - created_at < cooldown
            ]
            self._recent_event_boxes[spatial_key] = recent
            if any(bbox_match_score(previous_bbox, event.bbox) is not None for _, previous_bbox in recent):
                continue

            accepted.append(event)
            self._last_events[track_key] = now_monotonic
            recent.append((now_monotonic, list(event.bbox)))
        return accepted

    @classmethod
    def _encode_preview(cls, frame: np.ndarray) -> bytes | None:
        height, width = frame.shape[:2]
        if width > cls.PREVIEW_MAX_WIDTH:
            scale = cls.PREVIEW_MAX_WIDTH / width
            frame = cv2.resize(
                frame,
                (cls.PREVIEW_MAX_WIDTH, max(1, round(height * scale))),
                interpolation=cv2.INTER_AREA,
            )
        ok, encoded = cv2.imencode(
            ".jpg",
            frame,
            [cv2.IMWRITE_JPEG_QUALITY, cls.PREVIEW_JPEG_QUALITY],
        )
        return encoded.tobytes() if ok else None

    def _set_offline(self, camera_id: int, error: str | None = None) -> None:
        self._preview_frames.pop(camera_id, None)
        db = SessionLocal()
        try:
            camera = db.query(Camera).filter(Camera.id == camera_id).first()
            if camera:
                camera.is_online = False
                camera.measured_fps = 0.0
                if error:
                    camera.last_error = error[:2000]
                db.commit()
        finally:
            db.close()

    async def _deliver_email(
        self,
        delivery_id: int,
        camera_name: str,
        violation_type: str,
        event_id: int,
    ) -> None:
        db = SessionLocal()
        try:
            delivery = db.query(AlertDelivery).filter(AlertDelivery.id == delivery_id).first()
            if delivery is None:
                return
            for attempt in range(1, 4):
                delivery.attempts = attempt
                try:
                    await asyncio.to_thread(
                        email_notifier.send_violation,
                        camera_name,
                        violation_type,
                        event_id,
                    )
                    delivery.status = "sent"
                    delivery.sent_at = datetime.now(timezone.utc)
                    delivery.last_error = None
                    db.commit()
                    return
                except Exception as exc:
                    delivery.status = "retrying" if attempt < 3 else "failed"
                    delivery.last_error = str(exc)[:2000]
                    db.commit()
                    if attempt < 3:
                        await asyncio.sleep(2 ** (attempt - 1))
        finally:
            db.close()

    @staticmethod
    def _detection_options(db, camera: Camera) -> tuple[list[str], float, float, bool]:
        required = ["helmet", "safety-vest"]
        if camera.zone_id:
            zone = db.query(Zone).filter(Zone.id == camera.zone_id, Zone.is_active.is_(True)).first()
            if zone and zone.required_ppe:
                filtered = [item for item in zone.required_ppe if item in {"helmet", "safety-vest"}]
                if filtered:
                    required = filtered

        confidence = settings.CONFIDENCE_THRESHOLD
        person_confidence = settings.PERSON_CONFIDENCE_THRESHOLD
        save_evidence = True
        if camera.owner_id:
            user_settings = db.query(UserSettings).filter(UserSettings.user_id == camera.owner_id).first()
            if user_settings:
                person_confidence = max(0.1, min(0.9, user_settings.confidence_threshold / 100))
                confidence = ppe_sensitivity_to_confidence(user_settings.ppe_detection_sensitivity)
                save_evidence = user_settings.save_evidence
        return required, confidence, person_confidence, save_evidence

    @staticmethod
    def _filter_to_zone(result: dict[str, Any], zone: Zone | None, frame_shape) -> dict[str, Any]:
        if not zone or not zone.polygon_points or len(zone.polygon_points) < 3:
            return result
        image_height, image_width = frame_shape[:2]
        polygon: list[tuple[float, float]] = []
        normalized = all(max(point) <= 1 for point in zone.polygon_points if len(point) >= 2)
        for point in zone.polygon_points:
            if len(point) < 2:
                continue
            x, y = float(point[0]), float(point[1])
            polygon.append((x * image_width if normalized else x, y * image_height if normalized else y))
        if len(polygon) < 3:
            return result

        filtered = []
        for person in result.get("persons", []):
            x1, y1, x2, y2 = person["bbox"]
            point = ((x1 + x2) / 2, y2)
            if cv2.pointPolygonTest(np.array(polygon, dtype="float32"), point, False) >= 0:
                filtered.append(person)
        result["persons"] = filtered
        result["person_count"] = len(filtered)
        result["violation_count"] = sum(not person.get("is_compliant", True) for person in filtered)
        result["has_violation"] = result["violation_count"] > 0
        return result

    async def _persist_events(
        self,
        db,
        camera: Camera,
        frame,
        result: dict[str, Any],
        events: list[ConfirmedViolation],
        recorder: EvidenceRecorder,
        save_evidence: bool,
    ) -> None:
        grouped: dict[int, list[ConfirmedViolation]] = defaultdict(list)
        for event in events:
            grouped[event.track_id].append(event)

        for track_id, track_events in grouped.items():
            email_jobs: list[tuple[int, str, str, int]] = []
            violations = [event.violation_type for event in track_events]
            snapshot_path: Path | None = None
            if save_evidence:
                annotated = self.detector.draw_detections(frame, result)
                privacy_frame = blur_person_heads(annotated, result.get("persons", []))
                snapshot_path = Path(settings.EVIDENCE_DIR).resolve() / f"camera_{camera.id}_{uuid.uuid4().hex}.jpg"
                snapshot_path.parent.mkdir(parents=True, exist_ok=True)
                await asyncio.to_thread(cv2.imwrite, str(snapshot_path), privacy_frame)

            detection = Detection(
                user_id=camera.owner_id,
                zone_id=camera.zone_id,
                original_image_path=f"camera:{camera.id}",
                result_image_path=str(snapshot_path) if snapshot_path else None,
                detected_objects=result.get("detected_objects", []),
                persons=result.get("persons", []),
                violations=violations,
                person_count=result.get("person_count", 0),
                violation_count=1,
                has_violation=True,
                processing_time_ms=result.get("processing_time_ms", 0),
                summary={
                    "status": "violation",
                    "message": ", ".join(violations),
                    "track_id": track_id,
                    "model_version": settings.MODEL_VERSION,
                },
            )
            db.add(detection)
            db.flush()

            for event in track_events:
                now = datetime.now(timezone.utc)
                violation_log = ViolationLog(
                    user_id=camera.owner_id,
                    camera_id=camera.id,
                    zone_id=camera.zone_id,
                    detection_id=detection.id,
                    violation_type=event.violation_type,
                    track_id=event.track_id,
                    confidence_score=round(event.confidence * 100),
                    person_count=1,
                    snapshot_path=str(snapshot_path) if snapshot_path else None,
                    bbox_data=event.bbox,
                    model_version=settings.MODEL_VERSION,
                    status="new",
                    first_seen=now,
                    last_seen=now,
                )
                db.add(violation_log)
                db.flush()

                alert = Alert(
                    detection_id=detection.id,
                    violation_log_id=violation_log.id,
                    alert_type=event.violation_type,
                    message=f"Confirmed PPE violation at {camera.name}: {event.violation_type}",
                )
                db.add(alert)
                db.flush()
                if save_evidence:
                    recorder.start_event(violation_log.id)

                if email_notifier.configured:
                    delivery = AlertDelivery(
                        alert_id=alert.id,
                        channel="email",
                        recipients=settings.alert_recipients_list,
                        status="queued",
                    )
                    db.add(delivery)
                    db.flush()
                    email_jobs.append((delivery.id, camera.name, event.violation_type, violation_log.id))

                await ws_manager.broadcast_alert(
                    {
                        "event_id": violation_log.id,
                        "detection_id": detection.id,
                        "camera_id": camera.id,
                        "camera_name": camera.name,
                        "violation_type": event.violation_type,
                        "created_at": now.isoformat(),
                    },
                    user_id=camera.owner_id,
                )
            if camera.zone_id:
                zone = db.query(Zone).filter(Zone.id == camera.zone_id).first()
                if zone:
                    zone.total_violations = int(zone.total_violations or 0) + len(track_events)
            db.commit()
            for delivery_id, camera_name, violation_type, event_id in email_jobs:
                asyncio.create_task(
                    self._deliver_email(delivery_id, camera_name, violation_type, event_id),
                    name=f"ppe-email-{delivery_id}",
                )

    async def _run(self, camera_id: int) -> None:
        db = SessionLocal()
        cap = None
        try:
            camera = db.query(Camera).filter(Camera.id == camera_id).first()
            if not camera:
                return
            camera.is_active = True
            camera.started_at = datetime.now(timezone.utc)
            camera.last_error = None
            camera.frames_analyzed = 0
            db.commit()

            if self.detector is None:
                self.detector = get_detector()

            tracker = TemporalViolationTracker(
                window_size=settings.TEMPORAL_WINDOW_SIZE,
                confirm_count=settings.TEMPORAL_CONFIRM_COUNT,
                clear_count=settings.TEMPORAL_CLEAR_COUNT,
            )
            recorder = EvidenceRecorder(
                Path(settings.EVIDENCE_DIR).resolve(),
                camera_id=camera.id,
                fps=max(1, round(settings.CAMERA_ANALYSIS_FPS)),
                pre_seconds=settings.EVIDENCE_PRE_SECONDS,
                post_seconds=settings.EVIDENCE_POST_SECONDS,
            )
            retry_seconds = 1
            analyzed = 0
            started = time.perf_counter()
            interval = 1 / max(0.5, settings.CAMERA_ANALYSIS_FPS)
            preview_interval = 1 / max(1.0, settings.CAMERA_PREVIEW_FPS)
            preview_generated_at = float("-inf")

            while True:
                camera = db.query(Camera).filter(Camera.id == camera_id).first()
                if not camera or not camera.is_active:
                    break
                if cap is None or not cap.isOpened():
                    if cap is not None:
                        cap.release()
                    cap = cv2.VideoCapture(_source_for_camera(camera))
                    _configure_capture(cap, camera)
                    if not cap.isOpened():
                        self._preview_frames.pop(camera_id, None)
                        camera.is_online = False
                        camera.last_error = "Could not open camera source"
                        db.commit()
                        await asyncio.sleep(retry_seconds)
                        retry_seconds = min(settings.CAMERA_RECONNECT_MAX_SECONDS, retry_seconds * 2)
                        continue
                    retry_seconds = 1
                    tracker.reset()

                loop_started = time.perf_counter()
                ok, frame = await asyncio.to_thread(cap.read)
                if not ok or frame is None:
                    self._preview_frames.pop(camera_id, None)
                    cap.release()
                    cap = None
                    camera.is_online = False
                    camera.last_error = "Camera returned no frame; reconnecting"
                    db.commit()
                    continue

                required, confidence, person_confidence, save_evidence = self._detection_options(db, camera)
                async with self._inference_lock:
                    result = await asyncio.to_thread(
                        self.detector.detect,
                        frame,
                        required,
                        confidence,
                        person_confidence,
                    )
                zone = db.query(Zone).filter(Zone.id == camera.zone_id).first() if camera.zone_id else None
                result = self._filter_to_zone(result, zone, frame.shape)
                confirmed = tracker.update(result.get("persons", []))
                now_monotonic = time.monotonic()
                confirmed = self._deduplicate_confirmed_events(camera.id, confirmed, now_monotonic)

                annotated_frame = None
                privacy_frame = None
                if save_evidence:
                    annotated_frame = self.detector.draw_detections(frame, result)
                    privacy_frame = blur_person_heads(
                        annotated_frame,
                        result.get("persons", []),
                    )
                    for event_id, frames in recorder.push(privacy_frame):
                        clip_path = await asyncio.to_thread(recorder.write_clip, event_id, frames)
                        if clip_path:
                            event_row = db.query(ViolationLog).filter(ViolationLog.id == event_id).first()
                            if event_row:
                                event_row.evidence_clip_path = clip_path
                                db.commit()

                preview_now = time.monotonic()
                if preview_now - preview_generated_at >= preview_interval:
                    if annotated_frame is None:
                        annotated_frame = self.detector.draw_detections(frame, result)
                    encoded_preview = self._encode_preview(annotated_frame)
                    if encoded_preview is not None:
                        self._preview_frames[camera_id] = (encoded_preview, time.time())
                        preview_generated_at = preview_now

                if confirmed:
                    await self._persist_events(db, camera, frame, result, confirmed, recorder, save_evidence)

                analyzed += 1
                elapsed = max(0.001, time.perf_counter() - started)
                camera.is_online = True
                camera.last_seen = datetime.now(timezone.utc)
                camera.last_error = None
                camera.frames_analyzed = analyzed
                camera.measured_fps = round(analyzed / elapsed, 2)
                db.commit()

                await ws_manager.broadcast_camera(
                    {
                        "camera_id": camera.id,
                        "is_online": True,
                        "measured_fps": camera.measured_fps,
                        "frames_analyzed": analyzed,
                        "last_seen": camera.last_seen.isoformat(),
                    },
                    user_id=camera.owner_id,
                )
                await asyncio.sleep(max(0.0, interval - (time.perf_counter() - loop_started)))
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            logger.exception("Camera runtime %s stopped unexpectedly", camera_id)
            try:
                db.rollback()
            except Exception:
                pass
            self._set_offline(camera_id, str(exc))
        finally:
            self._preview_frames.pop(camera_id, None)
            if cap is not None:
                cap.release()
            try:
                camera = db.query(Camera).filter(Camera.id == camera_id).first()
                if camera:
                    camera.is_online = False
                    camera.measured_fps = 0.0
                    db.commit()
            finally:
                db.close()
            self.tasks.pop(camera_id, None)


camera_runtime = CameraRuntimeManager()
