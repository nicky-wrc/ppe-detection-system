import asyncio
import threading
from types import SimpleNamespace

import cv2
import numpy as np
import pytest

import app.services.camera_runtime as camera_runtime_module
from app.services.camera_runtime import (
    CameraCaptureSpec,
    CameraCaptureWorker,
    CameraRuntimeManager,
    CaptureAttempt,
    _capture_attempts,
    _open_capture_with_frame,
    _release_open_result,
    test_camera_source as probe_camera_source,
)


class FakeCapture:
    def __init__(self, opened=True, frames=None):
        self.opened = opened
        self.frames = list(frames or [])
        self.properties = {}
        self.released = False

    def set(self, property_id, value):
        self.properties[property_id] = value
        return True

    def isOpened(self):
        return self.opened and not self.released

    def read(self):
        if self.frames:
            return self.frames.pop(0)
        return False, None

    def get(self, property_id):
        return self.properties.get(property_id, 0)

    def release(self):
        self.released = True


def test_windows_usb_capture_prefers_directshow_with_native_fallback():
    attempts = _capture_attempts(CameraCaptureSpec("usb", 0), platform_name="win32")

    assert [(attempt.backend, attempt.requested_profile) for attempt in attempts] == [
        (cv2.CAP_DSHOW, True),
        (cv2.CAP_DSHOW, False),
        (cv2.CAP_MSMF, True),
        (cv2.CAP_MSMF, False),
        (None, True),
        (None, False),
    ]


def test_usb_capture_falls_back_after_opened_backend_returns_no_frame(monkeypatch):
    frame = np.zeros((480, 640, 3), dtype=np.uint8)
    no_frame_capture = FakeCapture(frames=[(False, None)] * 8)
    working_capture = FakeCapture(frames=[(False, None), (True, frame)])
    captures = [no_frame_capture, working_capture]
    opened_with = []

    monkeypatch.setattr(
        camera_runtime_module,
        "_capture_attempts",
        lambda _spec: (
            CaptureAttempt(cv2.CAP_DSHOW, "DirectShow", True),
            CaptureAttempt(cv2.CAP_DSHOW, "DirectShow native", False),
        ),
    )
    monkeypatch.setattr(camera_runtime_module.time, "sleep", lambda _seconds: None)

    def fake_video_capture(source, backend):
        opened_with.append((source, backend))
        return captures.pop(0)

    monkeypatch.setattr(camera_runtime_module.cv2, "VideoCapture", fake_video_capture)

    cap, initial_frame, error, backend_name = _open_capture_with_frame(CameraCaptureSpec("usb", 0))

    assert cap is working_capture
    assert initial_frame is frame
    assert error is None
    assert backend_name == "DirectShow native"
    assert opened_with == [(0, cv2.CAP_DSHOW), (0, cv2.CAP_DSHOW)]
    assert no_frame_capture.released is True
    assert working_capture.released is False
    assert cv2.CAP_PROP_FRAME_WIDTH in no_frame_capture.properties
    assert cv2.CAP_PROP_FRAME_WIDTH not in working_capture.properties
    working_capture.release()


def test_usb_capture_keeps_automatic_backend_as_final_fallback(monkeypatch):
    frame = np.zeros((480, 640, 3), dtype=np.uint8)
    closed_capture = FakeCapture(opened=False)
    working_capture = FakeCapture(frames=[(True, frame)])
    captures = [closed_capture, working_capture]
    opened_with = []

    monkeypatch.setattr(
        camera_runtime_module,
        "_capture_attempts",
        lambda _spec: (
            CaptureAttempt(cv2.CAP_DSHOW, "DirectShow", True),
            CaptureAttempt(None, "automatic native", False),
        ),
    )

    def fake_video_capture(*args):
        opened_with.append(args)
        return captures.pop(0)

    monkeypatch.setattr(camera_runtime_module.cv2, "VideoCapture", fake_video_capture)

    cap, initial_frame, error, backend_name = _open_capture_with_frame(CameraCaptureSpec("usb", 1))

    assert cap is working_capture
    assert initial_frame is frame
    assert error is None
    assert backend_name == "automatic native"
    assert opened_with == [(1, cv2.CAP_DSHOW), (1,)]
    assert closed_capture.released is True
    working_capture.release()


def test_usb_capture_continues_after_backend_exception(monkeypatch):
    frame = np.zeros((480, 640, 3), dtype=np.uint8)
    working_capture = FakeCapture(frames=[(True, frame)])
    calls = []

    monkeypatch.setattr(
        camera_runtime_module,
        "_capture_attempts",
        lambda _spec: (
            CaptureAttempt(cv2.CAP_DSHOW, "DirectShow", True),
            CaptureAttempt(None, "automatic native", False),
        ),
    )

    def fake_video_capture(*args):
        calls.append(args)
        if len(calls) == 1:
            raise RuntimeError("driver initialization failed")
        return working_capture

    monkeypatch.setattr(camera_runtime_module.cv2, "VideoCapture", fake_video_capture)

    cap, initial_frame, error, backend_name = _open_capture_with_frame(CameraCaptureSpec("usb", 0))

    assert cap is working_capture
    assert initial_frame is frame
    assert error is None
    assert backend_name == "automatic native"
    assert calls == [(0, cv2.CAP_DSHOW), (0,)]
    working_capture.release()


def test_capture_worker_releases_late_open_result_after_cancellation(monkeypatch):
    cap = FakeCapture()
    frame = np.zeros((480, 640, 3), dtype=np.uint8)
    started = threading.Event()
    finish = threading.Event()
    monkeypatch.setattr(camera_runtime_module, "CAPTURE_CANCEL_GRACE_SECONDS", 0.01)

    def delayed_open():
        started.set()
        finish.wait(timeout=2)
        return cap, frame, None, "fake"

    async def scenario():
        worker = CameraCaptureWorker(99)
        try:
            task = asyncio.create_task(
                worker.call(delayed_open, cancel_cleanup=_release_open_result),
            )
            while not started.is_set():
                await asyncio.sleep(0.001)
            task.cancel()
            with pytest.raises(asyncio.CancelledError):
                await task
            assert cap.released is False
            assert worker._thread.daemon is True
            worker.close()

            finish.set()
            for _ in range(100):
                if cap.released:
                    break
                await asyncio.sleep(0.001)
            assert cap.released is True
        finally:
            finish.set()
            worker.close()

    asyncio.run(scenario())


def test_camera_source_releases_capture_and_returns_safe_no_frame_error(monkeypatch):
    capture = FakeCapture(frames=[(False, None)] * 8)
    monkeypatch.setattr(
        camera_runtime_module,
        "_capture_attempts",
        lambda _spec: (CaptureAttempt(cv2.CAP_DSHOW, "DirectShow", True),),
    )
    monkeypatch.setattr(camera_runtime_module.time, "sleep", lambda _seconds: None)
    monkeypatch.setattr(camera_runtime_module.cv2, "VideoCapture", lambda _source, _backend: capture)
    camera = SimpleNamespace(id=1, source_type="usb", device_index=0, rtsp_url=None)

    result = probe_camera_source(camera)

    assert result == {"ok": False, "error": "Camera opened but returned no frame"}
    assert capture.released is True


def test_runtime_waits_and_resets_fps_when_initial_frame_is_unavailable(monkeypatch):
    camera = SimpleNamespace(
        id=1,
        source_type="usb",
        device_index=0,
        rtsp_url=None,
        is_active=True,
        is_online=True,
        measured_fps=12.5,
        frames_analyzed=0,
        started_at=None,
        last_error=None,
    )

    class FakeQuery:
        def filter(self, *_args, **_kwargs):
            return self

        def first(self):
            return camera

    class FakeSession:
        def __init__(self):
            self.commits = 0
            self.closed = False

        def query(self, _model):
            return FakeQuery()

        def commit(self):
            self.commits += 1

        def rollback(self):
            pass

        def close(self):
            self.closed = True

    session = FakeSession()
    sleep_calls = []
    manager = CameraRuntimeManager()
    manager.detector = object()

    monkeypatch.setattr(camera_runtime_module, "SessionLocal", lambda: session)
    monkeypatch.setattr(camera_runtime_module, "EvidenceRecorder", lambda *_args, **_kwargs: object())
    monkeypatch.setattr(
        camera_runtime_module,
        "_open_capture_with_frame",
        lambda _spec: (None, None, "Camera opened but returned no frame", None),
    )

    async def fake_sleep(seconds):
        sleep_calls.append(seconds)
        camera.is_active = False

    monkeypatch.setattr(camera_runtime_module.asyncio, "sleep", fake_sleep)

    asyncio.run(manager._run(camera.id))

    assert sleep_calls == [1]
    assert camera.is_online is False
    assert camera.measured_fps == 0.0
    assert camera.last_error == "Camera opened but returned no frame; retrying"
    assert session.commits >= 2
    assert session.closed is True


def test_runtime_releases_capture_and_backs_off_after_read_failure(monkeypatch):
    initial_frame = np.zeros((48, 64, 3), dtype=np.uint8)
    capture = FakeCapture(frames=[(False, None)])
    camera = SimpleNamespace(
        id=2,
        name="USB Camera",
        source_type="usb",
        device_index=1,
        rtsp_url=None,
        zone_id=None,
        owner_id=None,
        is_active=True,
        is_online=False,
        measured_fps=0.0,
        frames_analyzed=0,
        started_at=None,
        last_seen=None,
        last_error=None,
    )

    class FakeQuery:
        def filter(self, *_args, **_kwargs):
            return self

        def first(self):
            return camera

    class FakeSession:
        def query(self, _model):
            return FakeQuery()

        def commit(self):
            pass

        def rollback(self):
            pass

        def close(self):
            pass

    class FakeDetector:
        def detect(self, *_args, **_kwargs):
            return {
                "persons": [],
                "detected_objects": [],
                "person_count": 0,
                "violation_count": 0,
                "has_violation": False,
                "processing_time_ms": 1,
            }

        def draw_detections(self, frame, _result):
            return frame

    class FakeRecorder:
        def push(self, _frame):
            return []

    manager = CameraRuntimeManager()
    manager.detector = FakeDetector()
    sleep_calls = []

    monkeypatch.setattr(camera_runtime_module, "SessionLocal", FakeSession)
    monkeypatch.setattr(camera_runtime_module, "EvidenceRecorder", lambda *_args, **_kwargs: FakeRecorder())
    monkeypatch.setattr(
        camera_runtime_module,
        "_open_capture_with_frame",
        lambda _spec: (capture, initial_frame, None, "fake"),
    )

    async def fake_broadcast_camera(*_args, **_kwargs):
        return None

    async def fake_sleep(seconds):
        sleep_calls.append(seconds)
        if seconds >= 1:
            camera.is_active = False

    monkeypatch.setattr(camera_runtime_module.ws_manager, "broadcast_camera", fake_broadcast_camera)
    monkeypatch.setattr(camera_runtime_module.asyncio, "sleep", fake_sleep)

    asyncio.run(manager._run(camera.id))

    assert any(seconds >= 1 for seconds in sleep_calls)
    assert capture.released is True
    assert camera.is_online is False
    assert camera.measured_fps == 0.0
    assert camera.last_error == "Camera returned no frame; reconnecting"
