from collections import deque
from pathlib import Path

import cv2
import numpy as np


class EvidenceRecorder:
    """In-memory, privacy-filtered ring buffer for short event clips."""

    def __init__(self, output_dir: Path, camera_id: int, fps: int, pre_seconds: int, post_seconds: int):
        self.output_dir = output_dir
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.camera_id = camera_id
        self.fps = max(1, fps)
        self.pre_frames = max(1, self.fps * pre_seconds)
        self.post_frames = max(1, self.fps * post_seconds)
        self.buffer: deque[bytes] = deque(maxlen=self.pre_frames)
        self.active: dict[int, dict[str, object]] = {}

    @staticmethod
    def encode(frame: np.ndarray) -> bytes | None:
        ok, encoded = cv2.imencode(".jpg", frame, [int(cv2.IMWRITE_JPEG_QUALITY), 78])
        return encoded.tobytes() if ok else None

    def push(self, frame: np.ndarray) -> list[tuple[int, list[bytes]]]:
        encoded = self.encode(frame)
        if encoded is None:
            return []
        self.buffer.append(encoded)

        completed: list[tuple[int, list[bytes]]] = []
        for event_id, state in list(self.active.items()):
            frames = state["frames"]
            assert isinstance(frames, list)
            frames.append(encoded)
            state["remaining"] = int(state["remaining"]) - 1
            if int(state["remaining"]) <= 0:
                completed.append((event_id, frames))
                del self.active[event_id]
        return completed

    def start_event(self, event_id: int) -> None:
        self.active[event_id] = {
            "frames": list(self.buffer),
            "remaining": self.post_frames,
        }

    def write_clip(self, event_id: int, frames: list[bytes]) -> str | None:
        if not frames:
            return None
        decoded_first = cv2.imdecode(np.frombuffer(frames[0], dtype=np.uint8), cv2.IMREAD_COLOR)
        if decoded_first is None:
            return None
        height, width = decoded_first.shape[:2]
        path = self.output_dir / f"camera_{self.camera_id}_event_{event_id}.mp4"
        writer = cv2.VideoWriter(
            str(path),
            cv2.VideoWriter_fourcc(*"mp4v"),
            self.fps,
            (width, height),
        )
        if not writer.isOpened():
            return None
        try:
            for encoded in frames:
                frame = cv2.imdecode(np.frombuffer(encoded, dtype=np.uint8), cv2.IMREAD_COLOR)
                if frame is None:
                    continue
                if frame.shape[1] != width or frame.shape[0] != height:
                    frame = cv2.resize(frame, (width, height))
                writer.write(frame)
        finally:
            writer.release()
        if path.exists() and path.stat().st_size > 1000:
            return str(path)
        path.unlink(missing_ok=True)
        return None


def blur_person_heads(frame: np.ndarray, persons: list[dict]) -> np.ndarray:
    """Blur the upper person region before evidence is persisted."""
    result = frame.copy()
    image_height, image_width = result.shape[:2]
    for person in persons:
        bbox = person.get("bbox") or []
        if len(bbox) != 4:
            continue
        x1, y1, x2, y2 = map(int, bbox)
        height = max(0, y2 - y1)
        head_bottom = y1 + int(height * 0.28)
        x1, x2 = max(0, x1), min(image_width, x2)
        y1, head_bottom = max(0, y1), min(image_height, head_bottom)
        region = result[y1:head_bottom, x1:x2]
        if region.size == 0:
            continue
        kernel_x = max(15, ((region.shape[1] // 6) | 1))
        kernel_y = max(15, ((region.shape[0] // 6) | 1))
        result[y1:head_bottom, x1:x2] = cv2.GaussianBlur(region, (kernel_x, kernel_y), 0)
    return result
