import json
import sys
from datetime import datetime, timezone
from types import SimpleNamespace

import pytest

from app.ml.evaluate_events import (
    GroundTruthEvent,
    PredictedEvent,
    main as evaluate_events_main,
    read_ground_truth,
    read_predictions,
    score_events,
)
from app.ml.evaluate_ppe import build_per_class_metrics


def utc(second: int) -> datetime:
    return datetime(2026, 7, 29, 12, 0, second, tzinfo=timezone.utc)


def truth(event_id: str, start: int, end: int, violation_type: str = "no_helmet") -> GroundTruthEvent:
    return GroundTruthEvent(
        event_id=event_id,
        camera_id="camera-1",
        zone_id="zone-a",
        violation_type=violation_type,
        start_time=utc(start),
        end_time=utc(end),
    )


def prediction(event_id: str, alert_time: int, violation_type: str = "no_helmet") -> PredictedEvent:
    return PredictedEvent(
        event_id=event_id,
        camera_id="camera-1",
        zone_id="zone-a",
        violation_type=violation_type,
        alert_time=utc(alert_time),
    )


def test_per_class_metrics_preserve_missing_test_class():
    box_metrics = SimpleNamespace(
        ap_class_index=[0, 2],
        f1=[0.75, 0.85],
        class_result=lambda index: [(0.8, 0.7, 0.9, 0.6), (0.9, 0.8, 0.95, 0.7)][index],
    )
    metrics = SimpleNamespace(box=box_metrics, nt_per_class=[12, 0, 8])

    rows = build_per_class_metrics(metrics, {0: "person", 1: "helmet", 2: "safety-vest"})

    assert rows[0] == {
        "class_id": 0,
        "class_name": "person",
        "targets": 12,
        "precision": 0.8,
        "recall": 0.7,
        "f1": 0.75,
        "ap50": 0.9,
        "ap50_95": 0.6,
    }
    assert rows[1]["class_name"] == "helmet"
    assert rows[1]["targets"] == 0
    assert rows[1]["precision"] is None
    assert rows[2]["f1"] == 0.85


def test_event_scoring_is_one_to_one_and_reports_acceptance():
    result = score_events(
        [truth("gt-1", 0, 5), truth("gt-2", 10, 15)],
        [prediction("prediction-1", 1), prediction("prediction-2", 2), prediction("prediction-3", 12)],
        camera_hours=2,
    )

    assert result["counts"] == {
        "ground_truth": 2,
        "predictions": 3,
        "true_positives": 2,
        "false_positives": 1,
        "false_negatives": 0,
    }
    assert result["metrics"]["precision"] == pytest.approx(2 / 3)
    assert result["metrics"]["recall"] == 1
    assert result["metrics"]["f1"] == pytest.approx(0.8)
    assert result["metrics"]["false_alerts_per_camera_hour"] == 0.5
    assert result["metrics"]["alert_latency_p50_seconds"] == 1.5
    assert result["metrics"]["alert_latency_p95_seconds"] == pytest.approx(1.95)
    assert result["false_positive_event_ids"] == ["prediction-2"]
    assert result["acceptance"]["checks"]["event_precision"]["passed"] is False
    assert result["acceptance"]["all_passed"] is False


def test_event_scoring_passes_locked_event_targets():
    result = score_events(
        [truth("gt-1", 0, 5), truth("gt-2", 10, 15, "no_safety_vest")],
        [prediction("prediction-1", 1), prediction("prediction-2", 12, "no_safety_vest")],
        camera_hours=1,
    )

    assert result["metrics"]["precision"] == 1
    assert result["metrics"]["recall"] == 1
    assert result["metrics"]["alert_latency_p95_seconds"] == pytest.approx(1.95)
    assert result["acceptance"]["all_passed"] is True


def test_event_scoring_maximizes_matches_for_overlapping_episodes():
    result = score_events(
        [truth("gt-1", 0, 5), truth("gt-2", 5, 10)],
        [prediction("prediction-1", 6), prediction("prediction-2", 9)],
        camera_hours=1,
    )

    assert result["counts"]["true_positives"] == 2
    assert result["counts"]["false_positives"] == 0
    assert result["counts"]["false_negatives"] == 0


def test_ground_truth_csv_rejects_timezone_free_timestamp(tmp_path):
    input_path = tmp_path / "ground_truth.csv"
    input_path.write_text(
        "event_id,camera_id,zone_id,violation_type,start_time,end_time\n"
        "gt-1,camera-1,zone-a,no_helmet,2026-07-29T12:00:00,2026-07-29T12:00:05+00:00\n",
        encoding="utf-8",
    )

    with pytest.raises(ValueError, match="start_time must include a timezone"):
        read_ground_truth(input_path)


def test_event_csv_readers_reject_missing_headers(tmp_path):
    truth_path = tmp_path / "ground_truth.csv"
    truth_path.write_text("event_id,camera_id\n", encoding="utf-8")
    predictions_path = tmp_path / "predictions.csv"
    predictions_path.write_text("event_id,alert_time\n", encoding="utf-8")

    with pytest.raises(ValueError, match="ground-truth CSV is missing columns"):
        read_ground_truth(truth_path)
    with pytest.raises(ValueError, match="prediction CSV is missing columns"):
        read_predictions(predictions_path)


def test_event_cli_writes_auditable_failed_report(tmp_path, monkeypatch):
    truth_path = tmp_path / "ground_truth.csv"
    truth_path.write_text(
        "event_id,camera_id,zone_id,violation_type,start_time,end_time\n"
        "gt-1,camera-1,zone-a,no_helmet,2026-07-29T12:00:00Z,2026-07-29T12:00:05Z\n",
        encoding="utf-8",
    )
    predictions_path = tmp_path / "predictions.csv"
    predictions_path.write_text(
        "event_id,camera_id,zone_id,violation_type,alert_time\n",
        encoding="utf-8",
    )
    output_path = tmp_path / "event_metrics.json"
    monkeypatch.setattr(
        sys,
        "argv",
        [
            "evaluate_events",
            "--ground-truth",
            str(truth_path),
            "--predictions",
            str(predictions_path),
            "--camera-hours",
            "1",
            "--output",
            str(output_path),
            "--require-pass",
        ],
    )

    with pytest.raises(SystemExit) as exit_info:
        evaluate_events_main()

    assert exit_info.value.code == 2
    report = json.loads(output_path.read_text(encoding="utf-8"))
    assert report["counts"]["false_negatives"] == 1
    assert report["acceptance"]["all_passed"] is False
    assert len(report["ground_truth_sha256"]) == 64
    assert len(report["predictions_sha256"]) == 64


@pytest.mark.parametrize(
    ("camera_hours", "grace_seconds", "message"),
    [(0, 3, "camera_hours"), (float("nan"), 3, "camera_hours"), (1, -1, "grace_seconds")],
)
def test_event_scoring_rejects_invalid_duration(camera_hours, grace_seconds, message):
    with pytest.raises(ValueError, match=message):
        score_events([], [], camera_hours=camera_hours, grace_seconds=grace_seconds)
