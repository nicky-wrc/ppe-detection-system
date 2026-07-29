"""Lightweight multi-frame confirmation for PPE violations.

The implementation intentionally has no optional native dependency. It can be
replaced by ByteTrack behind the same interface when the deployment image has
the required tracker packages installed.
"""

from collections import deque
from dataclasses import dataclass, field
from typing import Any


PPE_TYPES = ("helmet", "safety-vest")


def bbox_iou(a: list[float], b: list[float]) -> float:
    ax1, ay1, ax2, ay2 = a
    bx1, by1, bx2, by2 = b
    x1, y1 = max(ax1, bx1), max(ay1, by1)
    x2, y2 = min(ax2, bx2), min(ay2, by2)
    intersection = max(0.0, x2 - x1) * max(0.0, y2 - y1)
    area_a = max(0.0, ax2 - ax1) * max(0.0, ay2 - ay1)
    area_b = max(0.0, bx2 - bx1) * max(0.0, by2 - by1)
    union = area_a + area_b - intersection
    return intersection / union if union > 0 else 0.0


@dataclass
class ConfirmedViolation:
    track_id: int
    ppe_type: str
    bbox: list[float]
    confidence: float
    person: dict[str, Any]

    @property
    def violation_type(self) -> str:
        return f"no_{self.ppe_type.replace('-', '_')}"


@dataclass
class TrackState:
    track_id: int
    bbox: list[float]
    confidence: float
    history: dict[str, deque[bool]]
    confirmed: set[str] = field(default_factory=set)
    compliant_streak: dict[str, int] = field(default_factory=dict)
    missed_frames: int = 0


class TemporalViolationTracker:
    def __init__(
        self,
        window_size: int = 5,
        confirm_count: int = 4,
        clear_count: int = 3,
        iou_threshold: float = 0.25,
        max_missed_frames: int = 10,
    ):
        if not 1 <= confirm_count <= window_size:
            raise ValueError("confirm_count must be between 1 and window_size")
        self.window_size = window_size
        self.confirm_count = confirm_count
        self.clear_count = clear_count
        self.iou_threshold = iou_threshold
        self.max_missed_frames = max_missed_frames
        self.tracks: dict[int, TrackState] = {}
        self._next_track_id = 1

    def _new_track(self, person: dict[str, Any]) -> TrackState:
        track = TrackState(
            track_id=self._next_track_id,
            bbox=list(person["bbox"]),
            confidence=float(person.get("confidence", 0.0)),
            history={ppe: deque(maxlen=self.window_size) for ppe in PPE_TYPES},
            compliant_streak={ppe: 0 for ppe in PPE_TYPES},
        )
        self._next_track_id += 1
        self.tracks[track.track_id] = track
        return track

    def _match(self, persons: list[dict[str, Any]]) -> dict[int, dict[str, Any]]:
        available_tracks = set(self.tracks)
        matches: dict[int, dict[str, Any]] = {}

        candidates: list[tuple[float, int, int]] = []
        for person_index, person in enumerate(persons):
            for track_id, track in self.tracks.items():
                score = bbox_iou(track.bbox, person["bbox"])
                if score >= self.iou_threshold:
                    candidates.append((score, track_id, person_index))

        used_persons: set[int] = set()
        for _, track_id, person_index in sorted(candidates, reverse=True):
            if track_id not in available_tracks or person_index in used_persons:
                continue
            matches[track_id] = persons[person_index]
            available_tracks.remove(track_id)
            used_persons.add(person_index)

        for person_index, person in enumerate(persons):
            if person_index not in used_persons:
                track = self._new_track(person)
                matches[track.track_id] = person

        return matches

    def update(self, persons: list[dict[str, Any]]) -> list[ConfirmedViolation]:
        """Update tracks and return only newly confirmed violations."""
        matches = self._match(persons)
        confirmed_events: list[ConfirmedViolation] = []

        for track_id, track in list(self.tracks.items()):
            person = matches.get(track_id)
            if person is None:
                track.missed_frames += 1
                if track.missed_frames > self.max_missed_frames:
                    del self.tracks[track_id]
                continue

            track.missed_frames = 0
            track.bbox = list(person["bbox"])
            track.confidence = float(person.get("confidence", track.confidence))
            missing = set(person.get("not_wearing", []))

            for ppe_type in PPE_TYPES:
                is_missing = ppe_type in missing
                track.history[ppe_type].append(is_missing)
                track.compliant_streak[ppe_type] = 0 if is_missing else track.compliant_streak[ppe_type] + 1

                enough_history = len(track.history[ppe_type]) == self.window_size
                if (
                    enough_history
                    and sum(track.history[ppe_type]) >= self.confirm_count
                    and ppe_type not in track.confirmed
                ):
                    track.confirmed.add(ppe_type)
                    confirmed_events.append(
                        ConfirmedViolation(
                            track_id=track_id,
                            ppe_type=ppe_type,
                            bbox=track.bbox,
                            confidence=track.confidence,
                            person=person,
                        )
                    )

                if track.compliant_streak[ppe_type] >= self.clear_count:
                    track.confirmed.discard(ppe_type)

        return confirmed_events

    def reset(self) -> None:
        self.tracks.clear()
        self._next_track_id = 1
