import asyncio
import io
import threading
from unittest.mock import Mock

import cv2
import numpy as np
import pytest
from fastapi import UploadFile

from app.services.detection_service import DetectionService


def frame_file():
    success, encoded = cv2.imencode('.jpg', np.zeros((32, 32, 3), dtype=np.uint8))
    assert success
    return UploadFile(filename='frame.jpg', file=io.BytesIO(encoded.tobytes()))


def make_service(monkeypatch, detect):
    service = object.__new__(DetectionService)
    service.detector = Mock(detect=detect, engine_metadata={"device": "cpu", "crop_refinement": False})
    monkeypatch.setattr(service, '_get_detection_options', lambda *_: (['helmet', 'vest'], 0.2, 0.3))
    monkeypatch.setattr(service, '_settings_summary', lambda *_: {})
    return service


def test_frame_inference_leaves_event_loop_responsive(monkeypatch):
    started, release = threading.Event(), threading.Event()
    caller_thread = threading.get_ident()

    def detect(image, **options):
        assert threading.get_ident() != caller_thread
        assert image.shape == (32, 32, 3)
        assert options['confidence_threshold'] == 0.2
        started.set()
        assert release.wait(3), 'event loop did not release inference worker'
        return {'person_count': 1, 'persons': [], 'processing_time_ms': 123}

    service = make_service(monkeypatch, detect)

    async def check():
        task = asyncio.create_task(service.process_frame(frame_file(), user_id=1))
        try:
            async with asyncio.timeout(2):
                while not started.is_set():
                    await asyncio.sleep(0.01)
            # Health-check coroutines can execute while the model is still busy.
            assert not task.done()
            await asyncio.sleep(0.01)
        finally:
            release.set()
        result = await task
        assert result['person_count'] == 1
        assert result['processing_time_ms'] == 123
        assert result['original_image_path'] == 'live-camera-frame'

    asyncio.run(check())


def test_cancelled_frame_waits_for_worker_completion(monkeypatch):
    started, release, finished = threading.Event(), threading.Event(), threading.Event()

    def detect(*args, **kwargs):
        started.set()
        assert release.wait(3)
        finished.set()
        return {}

    service = make_service(monkeypatch, detect)

    async def check():
        task = asyncio.create_task(service.process_frame(frame_file()))
        try:
            async with asyncio.timeout(2):
                while not started.is_set():
                    await asyncio.sleep(0.01)
            task.cancel()
            await asyncio.sleep(0.01)
            assert not task.done(), 'request lock must outlive the active worker'
        finally:
            release.set()
        with pytest.raises(asyncio.CancelledError):
            await task
        assert finished.is_set()

    asyncio.run(check())


def test_ready_and_busy_response_work_during_demo_inference(monkeypatch, admin_headers):
    import httpx
    import app.services.detection_service as detection_module
    from app.core.config import settings
    from app.main import app

    started, release = threading.Event(), threading.Event()

    def detect(*args, **kwargs):
        started.set()
        assert release.wait(5), 'health checks were blocked by inference'
        return {'persons': [], 'person_count': 0}

    monkeypatch.setattr(settings, 'ENVIRONMENT', 'research_demo')
    monkeypatch.setattr(detection_module, 'get_detector', lambda: Mock(detect=detect, engine_metadata={"device": "cpu", "crop_refinement": False}))
    monkeypatch.setattr(DetectionService, '_get_detection_options', lambda *_: ([], 0.2, 0.3))
    monkeypatch.setattr(DetectionService, '_settings_summary', lambda *_: {})

    async def check():
        async with httpx.AsyncClient(app=app, base_url='http://test') as api_client:
            file = frame_file()
            task = asyncio.create_task(api_client.post('/api/v1/detection/frame',
                headers=admin_headers, files={'file': ('frame.jpg', file.file.read(), 'image/jpeg')}))
            try:
                async with asyncio.timeout(3):
                    while not started.is_set():
                        await asyncio.sleep(0.01)
                    ready = await api_client.get('/ready')
                    assert ready.status_code == 200
                    busy = await api_client.post('/api/v1/detection/frame', headers=admin_headers)
                    assert busy.status_code == 429
                    assert not task.done()
            finally:
                release.set()
            result = await task
            assert result.status_code == 200
            assert result.json()['person_count'] == 0

    asyncio.run(check())
