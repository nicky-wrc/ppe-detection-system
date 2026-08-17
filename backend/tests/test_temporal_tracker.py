from app.services.camera_runtime import CameraRuntimeManager
from app.services.temporal_tracker import ConfirmedViolation, TemporalViolationTracker, bbox_iou, bbox_match_score


def person(*missing: str, x: int = 0):
    return {
        "bbox": [x, 0, x + 100, 200],
        "confidence": 0.92,
        "not_wearing": list(missing),
        "wearing": [ppe for ppe in ("helmet", "safety-vest") if ppe not in missing],
        "is_compliant": not missing,
    }


def test_bbox_iou():
    assert bbox_iou([0, 0, 10, 10], [0, 0, 10, 10]) == 1
    assert bbox_iou([0, 0, 10, 10], [20, 20, 30, 30]) == 0


def test_bbox_match_score_tolerates_detector_box_jitter():
    assert bbox_iou([0, 0, 100, 200], [65, 0, 165, 200]) < 0.25
    assert bbox_match_score([0, 0, 100, 200], [65, 0, 165, 200]) is not None
    assert bbox_match_score([0, 0, 100, 200], [300, 0, 400, 200]) is None


def test_violation_requires_four_of_five_frames():
    tracker = TemporalViolationTracker(window_size=5, confirm_count=4, clear_count=3)
    frames = [person("helmet"), person("helmet"), person(), person("helmet"), person("helmet")]
    events = []
    for frame in frames:
        events.extend(tracker.update([frame]))
    assert len(events) == 1
    assert events[0].violation_type == "no_helmet"


def test_confirmed_violation_does_not_repeat_until_cleared():
    tracker = TemporalViolationTracker(window_size=5, confirm_count=4, clear_count=3)
    first = []
    for _ in range(6):
        first.extend(tracker.update([person("safety-vest")]))
    assert len(first) == 1

    for _ in range(3):
        assert tracker.update([person()]) == []

    repeated = []
    for _ in range(5):
        repeated.extend(tracker.update([person("safety-vest")]))
    assert len(repeated) == 1


def test_tracks_two_people_independently():
    tracker = TemporalViolationTracker(window_size=5, confirm_count=4, clear_count=3)
    events = []
    for _ in range(5):
        events.extend(tracker.update([person("helmet", x=0), person("safety-vest", x=200)]))
    assert {(event.track_id, event.violation_type) for event in events} == {
        (1, "no_helmet"),
        (2, "no_safety_vest"),
    }


def test_track_id_survives_large_box_shift():
    tracker = TemporalViolationTracker(window_size=3, confirm_count=2, clear_count=2)

    tracker.update([person("helmet", x=0)])
    shifted = person("helmet", x=65)
    tracker.update([shifted])
    events = tracker.update([shifted])

    assert len(tracker.tracks) == 1
    assert events[0].track_id == 1


def test_camera_event_deduplication_handles_reassigned_track_id():
    manager = CameraRuntimeManager()
    first = ConfirmedViolation(1, "helmet", [0, 0, 100, 200], 0.9, person("helmet"))
    reassigned = ConfirmedViolation(9, "helmet", [20, 0, 120, 200], 0.8, person("helmet", x=20))
    another_person = ConfirmedViolation(10, "helmet", [300, 0, 400, 200], 0.8, person("helmet", x=300))

    assert manager._deduplicate_confirmed_events(1, [first], 100.0) == [first]
    assert manager._deduplicate_confirmed_events(1, [reassigned], 101.0) == []
    assert manager._deduplicate_confirmed_events(1, [another_person], 101.0) == [another_person]
