from app.services.temporal_tracker import TemporalViolationTracker, bbox_iou


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
