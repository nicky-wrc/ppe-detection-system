from types import SimpleNamespace

import cv2
import numpy as np

from app.core.config import settings
from app.services.camera_runtime import CameraRuntimeManager, _configure_capture
from app.services.evidence_recorder import blur_person_heads


def test_blur_person_heads_only_changes_upper_region():
    rng = np.random.default_rng(42)
    image = rng.integers(0, 255, size=(200, 100, 3), dtype=np.uint8)
    person = {"bbox": [10, 10, 90, 190]}
    blurred = blur_person_heads(image, [person])

    assert not np.array_equal(blurred[10:60, 10:90], image[10:60, 10:90])
    assert np.array_equal(blurred[100:190, 10:90], image[100:190, 10:90])


def test_camera_preview_is_jpeg_and_bounded_in_memory():
    frame = np.zeros((720, 1280, 3), dtype=np.uint8)
    encoded = CameraRuntimeManager._encode_preview(frame)

    assert encoded is not None
    assert encoded.startswith(b"\xff\xd8")
    decoded = cv2.imdecode(np.frombuffer(encoded, dtype=np.uint8), cv2.IMREAD_COLOR)
    assert decoded is not None
    assert decoded.shape[1] == CameraRuntimeManager.PREVIEW_MAX_WIDTH
    assert decoded.shape[0] == 540


def test_usb_capture_requests_configured_resolution_and_fps():
    class FakeCapture:
        def __init__(self):
            self.properties = {}

        def set(self, property_id, value):
            self.properties[property_id] = value
            return True

    capture = FakeCapture()
    camera = SimpleNamespace(source_type="usb")

    _configure_capture(capture, camera)

    assert capture.properties[cv2.CAP_PROP_BUFFERSIZE] == settings.CAMERA_CAPTURE_BUFFER_SIZE
    assert capture.properties[cv2.CAP_PROP_FOURCC] == cv2.VideoWriter_fourcc(*"MJPG")
    assert capture.properties[cv2.CAP_PROP_FRAME_WIDTH] == settings.CAMERA_CAPTURE_WIDTH
    assert capture.properties[cv2.CAP_PROP_FRAME_HEIGHT] == settings.CAMERA_CAPTURE_HEIGHT
    assert capture.properties[cv2.CAP_PROP_FPS] == settings.CAMERA_CAPTURE_FPS
