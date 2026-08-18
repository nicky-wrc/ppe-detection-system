import asyncio
import logging
import sys
import time
import uuid
from collections import defaultdict
from concurrent.futures import Future
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from queue import Queue
from threading import Thread
from typing import Any, Callable

import cv2
import numpy as np

from app.core.config import settings
from app.core.database import SessionLocal
from app.models import Alert, AlertDelivery, Camera, Detection, UserSettings, ViolationLog, Zone
from app.services.email_notifier import email_notifier
from app.services.evidence_recorder import EvidenceRecorder, blur_person_heads
from app.services.temporal_tracker import ConfirmedViolation, TemporalViolationTracker, bbox_match_score
from app.services.websocket_manager import ws_manager

logger = logging.getLogger(__name__)

USB_INITIAL_READ_ATTEMPTS = 12
USB_INITIAL_READ_DELAY_SECONDS = 0.1
CAPTURE_CANCEL_GRACE_SECONDS = 1.0
LOCAL_CAMERA_DISCOVERY_MAX_INDEX = 10


def _get_detector():
    from app.ml.detector import get_detector

    return get_detector()


def _ppe_sensitivity_to_confidence(sensitivity: float) -> float:
    from app.ml.detector import ppe_sensitivity_to_confidence

    return ppe_sensitivity_to_confidence(sensitivity)


@dataclass(frozen=True)
class CameraCaptureSpec:
    source_type: str
    source: int | str


@dataclass(frozen=True)
class CaptureAttempt:
    backend: int | None
    backend_name: str
    requested_profile: bool


def _release_capture(cap: cv2.VideoCapture) -> None:
    try:
        cap.release()
    except Exception as exc:
        logger.warning("Camera capture release failed (%s)", type(exc).__name__)


def _release_open_result(future: Future[Any]) -> None:
    try:
        cap, _, _, _ = future.result()
    except Exception:
        return
    if cap is not None:
        _release_capture(cap)


def _release_capture_after_operation(cap: cv2.VideoCapture) -> Callable[[Future[Any]], None]:
    def cleanup(future: Future[Any]) -> None:
        try:
            future.result()
        except Exception:
            pass
        _release_capture(cap)

    return cleanup


class CameraCaptureWorker:
    """Keep one camera's blocking OpenCV operations on a dedicated thread."""

    def __init__(self, camera_id: int):
        self._queue: Queue[Any] = Queue()
        self._closed = False
        self._stop_token = object()
        self._thread = Thread(
            target=self._run,
            name=f"ppe-capture-{camera_id}",
            daemon=True,
        )
        self._thread.start()

    def _run(self) -> None:
        while True:
            item = self._queue.get()
            if item is self._stop_token:
                return
            future, function, args = item
            if not future.set_running_or_notify_cancel():
                continue
            try:
                result = function(*args)
            except BaseException as exc:
                future.set_exception(exc)
            else:
                future.set_result(result)

    def _submit(self, function: Callable[..., Any], *args) -> Future[Any]:
        if self._closed:
            raise RuntimeError("Camera capture worker is closed")
        future: Future[Any] = Future()
        self._queue.put((future, function, args))
        return future

    async def call(
        self,
        function: Callable[..., Any],
        *args,
        cancel_cleanup: Callable[[Future[Any]], None] | None = None,
    ) -> Any:
        future = self._submit(function, *args)
        wrapped = asyncio.wrap_future(future)
        try:
            return await asyncio.shield(wrapped)
        except asyncio.CancelledError:
            if cancel_cleanup is not None:
                # The single-worker queue guarantees cleanup runs on the same
                # thread immediately after the native operation completes.
                self._submit(cancel_cleanup, future)
            try:
                await asyncio.wait_for(
                    asyncio.shield(wrapped),
                    timeout=CAPTURE_CANCEL_GRACE_SECONDS,
                )
            except asyncio.TimeoutError:
                wrapped.cancel()
            except Exception:
                pass
            raise

    async def release(self, cap: cv2.VideoCapture) -> None:
        try:
            await asyncio.wait_for(
                self.call(_release_capture, cap),
                timeout=CAPTURE_CANCEL_GRACE_SECONDS,
            )
        except asyncio.TimeoutError:
            logger.warning("Timed out while releasing camera capture; cleanup continues in worker")

    def close(self) -> None:
        # Running native calls cannot be force-killed safely. Their cancellation
        # callback releases the capture on this daemon worker if the call returns,
        # while a broken driver cannot block interpreter shutdown indefinitely.
        if self._closed:
            return
        self._closed = True
        self._queue.put(self._stop_token)


def _source_for_camera(camera: Camera) -> int | str:
    if camera.source_type == "usb":
        return int(camera.device_index or 0)
    if camera.source_type in {"rtsp", "file"} and camera.rtsp_url:
        return camera.rtsp_url
    raise ValueError(f"Camera {camera.id} has an invalid source configuration")


def _capture_spec(camera: Camera) -> CameraCaptureSpec:
    return CameraCaptureSpec(source_type=camera.source_type, source=_source_for_camera(camera))


def _configure_capture_profile(
    cap: cv2.VideoCapture,
    source_type: str,
    requested_profile: bool,
) -> None:
    """Apply low-latency capture settings without assuming RTSP supports USB properties."""

    cap.set(cv2.CAP_PROP_BUFFERSIZE, max(1, settings.CAMERA_CAPTURE_BUFFER_SIZE))
    if source_type != "usb" or not requested_profile:
        return
    cap.set(cv2.CAP_PROP_FOURCC, cv2.VideoWriter_fourcc(*"MJPG"))
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, max(320, settings.CAMERA_CAPTURE_WIDTH))
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, max(240, settings.CAMERA_CAPTURE_HEIGHT))
    cap.set(cv2.CAP_PROP_FPS, max(1.0, settings.CAMERA_CAPTURE_FPS))


def _configure_capture(cap: cv2.VideoCapture, camera: Camera) -> None:
    _configure_capture_profile(cap, camera.source_type, requested_profile=True)


def _capture_attempts(spec: CameraCaptureSpec, platform_name: str | None = None) -> tuple[CaptureAttempt, ...]:
    if spec.source_type != "usb":
        return (CaptureAttempt(None, "automatic", True),)

    platform = platform_name or sys.platform
    if platform == "win32":
        # Acer and other OEM camera transforms can reject a requested MSMF media type.
        # DirectShow bypasses that transform; native-profile attempts cover devices that
        # do not support the requested MJPEG 1280x720 mode.
        return (
            CaptureAttempt(cv2.CAP_DSHOW, "DirectShow", True),
            CaptureAttempt(cv2.CAP_DSHOW, "DirectShow native", False),
            CaptureAttempt(cv2.CAP_MSMF, "Media Foundation", True),
            CaptureAttempt(cv2.CAP_MSMF, "Media Foundation native", False),
            CaptureAttempt(None, "automatic", True),
            CaptureAttempt(None, "automatic native", False),
        )
    if platform == "darwin":
        return (
            CaptureAttempt(cv2.CAP_AVFOUNDATION, "AVFoundation", True),
            CaptureAttempt(cv2.CAP_AVFOUNDATION, "AVFoundation native", False),
            CaptureAttempt(None, "automatic", True),
            CaptureAttempt(None, "automatic native", False),
        )
    if platform.startswith("linux"):
        return (
            CaptureAttempt(cv2.CAP_V4L2, "V4L2", True),
            CaptureAttempt(cv2.CAP_V4L2, "V4L2 native", False),
            CaptureAttempt(None, "automatic", True),
            CaptureAttempt(None, "automatic native", False),
        )
    return (
        CaptureAttempt(None, "automatic", True),
        CaptureAttempt(None, "automatic native", False),
    )


def _new_capture(source: int | str, backend: int | None) -> cv2.VideoCapture:
    if backend is None:
        return cv2.VideoCapture(source)
    return cv2.VideoCapture(source, backend)


def _camera_open_error(spec: CameraCaptureSpec, opened_without_frame: bool) -> str:
    if opened_without_frame:
        return "Camera opened but returned no frame"
    if spec.source_type == "usb" and sys.platform == "darwin":
        return (
            "Could not open camera source. macOS may be blocking backend camera access; "
            "grant Camera permission to the app running the backend, restart it, then try again"
        )
    return "Could not open camera source"


def _read_initial_frame(
    cap: cv2.VideoCapture,
    attempts: int,
    delay_seconds: float,
) -> np.ndarray | None:
    for attempt_index in range(attempts):
        ok, frame = cap.read()
        if ok and frame is not None:
            return frame
        if attempt_index + 1 < attempts:
            time.sleep(delay_seconds)
    return None


def _open_capture_with_frame(
    spec: CameraCaptureSpec,
) -> tuple[cv2.VideoCapture | None, np.ndarray | None, str | None, str | None]:
    """Open a source and return its first frame, trying safe Windows USB fallbacks."""

    opened_without_frame = False
    for attempt in _capture_attempts(spec):
        cap = None
        keep_capture = False
        try:
            cap = _new_capture(spec.source, attempt.backend)
            _configure_capture_profile(cap, spec.source_type, attempt.requested_profile)
            if not cap.isOpened():
                continue
            opened_without_frame = True
            read_attempts = USB_INITIAL_READ_ATTEMPTS if spec.source_type == "usb" else 1
            frame = _read_initial_frame(
                cap,
                attempts=read_attempts,
                delay_seconds=USB_INITIAL_READ_DELAY_SECONDS,
            )
            if frame is None:
                continue
            keep_capture = True
            return cap, frame, None, attempt.backend_name
        except Exception as exc:
            logger.warning(
                "Camera capture attempt %s failed (%s); trying the next backend",
                attempt.backend_name,
                type(exc).__name__,
            )
        finally:
            if cap is not None and not keep_capture:
                _release_capture(cap)

    return None, None, _camera_open_error(spec, opened_without_frame), None


def test_camera_source(camera: Camera) -> dict[str, Any]:
    cap, frame, error, _ = _open_capture_with_frame(_capture_spec(camera))
    if cap is None or frame is None:
        return {"ok": False, "error": error or "Could not open camera source"}
    try:
        return {
            "ok": True,
            "width": int(frame.shape[1]),
            "height": int(frame.shape[0]),
            "fps": float(cap.get(cv2.CAP_PROP_FPS) or 0),
        }
    finally:
        _release_capture(cap)


def discover_local_camera_sources(max_index: int = LOCAL_CAMERA_DISCOVERY_MAX_INDEX) -> list[dict[str, Any]]:
    devices: list[dict[str, Any]] = []
    for index in range(max(0, max_index) + 1):
        spec = CameraCaptureSpec("usb", index)
        cap, frame, error, backend_name = _open_capture_with_frame(spec)
        if cap is None or frame is None:
            continue
        try:
            devices.append(
                {
                    "device_index": index,
                    "label": f"Camera {index}",
                    "width": int(frame.shape[1]),
                    "height": int(frame.shape[0]),
                    "fps": float(cap.get(cv2.CAP_PROP_FPS) or 0),
                    "backend_name": backend_name or "automatic",
                }
            )
        finally:
            _release_capture(cap)
    return devices


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
                confidence = _ppe_sensitivity_to_confidence(user_settings.ppe_detection_sensitivity)
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
        initial_frame = None
        capture_worker = CameraCaptureWorker(camera_id)

        try:
            camera = db.query(Camera).filter(Camera.id == camera_id).first()
            if not camera:
                return
            camera.is_active = True
            camera.started_at = datetime.now(timezone.utc)
            camera.last_error = None
            camera.frames_analyzed = 0
            db.commit()

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
                if cap is None:
                    spec = _capture_spec(camera)
                    cap, initial_frame, capture_error, capture_backend = await capture_worker.call(
                        _open_capture_with_frame,
                        spec,
                        cancel_cleanup=_release_open_result,
                    )
                    if cap is None:
                        self._preview_frames.pop(camera_id, None)
                        camera.is_online = False
                        camera.measured_fps = 0.0
                        camera.last_error = f"{capture_error or 'Could not open camera source'}; retrying"
                        db.commit()
                        await asyncio.sleep(retry_seconds)
                        retry_seconds = min(settings.CAMERA_RECONNECT_MAX_SECONDS, retry_seconds * 2)
                        continue
                    logger.info(
                        "Camera runtime %s opened USB/video source with %s",
                        camera_id,
                        capture_backend or "automatic backend",
                    )
                    tracker.reset()

                loop_started = time.perf_counter()
                if initial_frame is not None:
                    ok, frame = True, initial_frame
                    initial_frame = None
                else:
                    try:
                        ok, frame = await capture_worker.call(
                            cap.read,
                            cancel_cleanup=_release_capture_after_operation(cap),
                        )
                    except asyncio.CancelledError:
                        # The worker callback owns release after a pending native read.
                        cap = None
                        raise
                    except Exception as exc:
                        logger.warning(
                            "Camera runtime %s read failed (%s)",
                            camera_id,
                            type(exc).__name__,
                        )
                        ok, frame = False, None
                if not ok or frame is None:
                    self._preview_frames.pop(camera_id, None)
                    capture_to_release = cap
                    cap = None
                    await capture_worker.release(capture_to_release)
                    camera.is_online = False
                    camera.measured_fps = 0.0
                    camera.last_error = "Camera returned no frame; reconnecting"
                    db.commit()
                    await asyncio.sleep(retry_seconds)
                    retry_seconds = min(settings.CAMERA_RECONNECT_MAX_SECONDS, retry_seconds * 2)
                    continue

                if camera.source_type == "usb":
                    frame = cv2.flip(frame, 1)

                retry_seconds = 1

                preview_now = time.monotonic()
                if self.detector is None and preview_now - preview_generated_at >= preview_interval:
                    encoded_preview = self._encode_preview(frame)
                    if encoded_preview is not None:
                        self._preview_frames[camera_id] = (encoded_preview, time.time())
                        preview_generated_at = preview_now
                        camera.is_online = True
                        camera.last_seen = datetime.now(timezone.utc)
                        camera.last_error = None
                        db.commit()

                required, confidence, person_confidence, save_evidence = self._detection_options(db, camera)
                async with self._inference_lock:
                    if self.detector is None:
                        self.detector = await asyncio.to_thread(_get_detector)
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
            self._set_offline(camera_id, "Camera runtime stopped unexpectedly")
        finally:
            self._preview_frames.pop(camera_id, None)
            if cap is not None:
                capture_to_release = cap
                cap = None
                try:
                    await capture_worker.release(capture_to_release)
                except (RuntimeError, asyncio.CancelledError):
                    pass
            capture_worker.close()
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
