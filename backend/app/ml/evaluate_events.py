"""Score confirmed PPE events against a locked, human-reviewed scenario sheet."""

import argparse
import csv
import hashlib
import json
import math
from collections import deque
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any


MIN_EVENT_PRECISION = 0.85
MIN_EVENT_RECALL = 0.90
MAX_FALSE_ALERTS_PER_CAMERA_HOUR = 1.0
MAX_P95_ALERT_LATENCY_SECONDS = 3.0


@dataclass(frozen=True)
class GroundTruthEvent:
    event_id: str
    camera_id: str
    zone_id: str | None
    violation_type: str
    start_time: datetime
    end_time: datetime


@dataclass(frozen=True)
class PredictedEvent:
    event_id: str
    camera_id: str
    zone_id: str | None
    violation_type: str
    alert_time: datetime


def parse_timestamp(value: str, *, field_name: str, row_number: int) -> datetime:
    normalized = value.strip().replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError as exc:
        raise ValueError(f"row {row_number}: {field_name} must be an ISO-8601 timestamp") from exc
    if parsed.tzinfo is None or parsed.utcoffset() is None:
        raise ValueError(f"row {row_number}: {field_name} must include a timezone")
    return parsed.astimezone(timezone.utc)


def _required(row: dict[str, str | None], field_name: str, row_number: int) -> str:
    value = (row.get(field_name) or "").strip()
    if not value:
        raise ValueError(f"row {row_number}: {field_name} is required")
    return value


def _optional(row: dict[str, str | None], field_name: str) -> str | None:
    value = (row.get(field_name) or "").strip()
    return value or None


def read_ground_truth(path: str | Path) -> list[GroundTruthEvent]:
    events: list[GroundTruthEvent] = []
    seen_ids: set[str] = set()
    with Path(path).open(newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        required_fields = {"event_id", "camera_id", "violation_type", "start_time", "end_time"}
        missing_fields = required_fields - set(reader.fieldnames or [])
        if missing_fields:
            raise ValueError(f"ground-truth CSV is missing columns: {', '.join(sorted(missing_fields))}")
        for row_number, row in enumerate(reader, start=2):
            event_id = _required(row, "event_id", row_number)
            if event_id in seen_ids:
                raise ValueError(f"row {row_number}: duplicate ground-truth event_id {event_id!r}")
            start_time = parse_timestamp(
                _required(row, "start_time", row_number),
                field_name="start_time",
                row_number=row_number,
            )
            end_time = parse_timestamp(
                _required(row, "end_time", row_number),
                field_name="end_time",
                row_number=row_number,
            )
            if end_time < start_time:
                raise ValueError(f"row {row_number}: end_time cannot be before start_time")
            seen_ids.add(event_id)
            events.append(
                GroundTruthEvent(
                    event_id=event_id,
                    camera_id=_required(row, "camera_id", row_number),
                    zone_id=_optional(row, "zone_id"),
                    violation_type=_required(row, "violation_type", row_number),
                    start_time=start_time,
                    end_time=end_time,
                )
            )
    return events


def read_predictions(path: str | Path) -> list[PredictedEvent]:
    events: list[PredictedEvent] = []
    seen_ids: set[str] = set()
    with Path(path).open(newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        required_fields = {"event_id", "camera_id", "violation_type", "alert_time"}
        missing_fields = required_fields - set(reader.fieldnames or [])
        if missing_fields:
            raise ValueError(f"prediction CSV is missing columns: {', '.join(sorted(missing_fields))}")
        for row_number, row in enumerate(reader, start=2):
            event_id = _required(row, "event_id", row_number)
            if event_id in seen_ids:
                raise ValueError(f"row {row_number}: duplicate predicted event_id {event_id!r}")
            seen_ids.add(event_id)
            events.append(
                PredictedEvent(
                    event_id=event_id,
                    camera_id=_required(row, "camera_id", row_number),
                    zone_id=_optional(row, "zone_id"),
                    violation_type=_required(row, "violation_type", row_number),
                    alert_time=parse_timestamp(
                        _required(row, "alert_time", row_number),
                        field_name="alert_time",
                        row_number=row_number,
                    ),
                )
            )
    return events


def percentile(values: list[float], percent: float) -> float | None:
    """Return a linearly interpolated percentile for deterministic small pilot samples."""
    if not values:
        return None
    ordered = sorted(values)
    rank = (len(ordered) - 1) * percent
    lower = math.floor(rank)
    upper = math.ceil(rank)
    if lower == upper:
        return ordered[lower]
    weight = rank - lower
    return ordered[lower] * (1 - weight) + ordered[upper] * weight


def _same_event_scope(truth: GroundTruthEvent, prediction: PredictedEvent) -> bool:
    if truth.camera_id != prediction.camera_id or truth.violation_type != prediction.violation_type:
        return False
    return truth.zone_id is None or truth.zone_id == prediction.zone_id


def _maximum_event_matching(
    ground_truth: list[GroundTruthEvent],
    predictions: list[PredictedEvent],
    grace: timedelta,
) -> dict[int, int]:
    """Return prediction-to-truth indexes using deterministic maximum matching."""
    candidate_truth: dict[int, list[int]] = {}
    prediction_order = sorted(
        range(len(predictions)),
        key=lambda index: (predictions[index].alert_time, predictions[index].event_id),
    )
    for prediction_index in prediction_order:
        prediction = predictions[prediction_index]
        candidate_truth[prediction_index] = sorted(
            (
                truth_index
                for truth_index, truth in enumerate(ground_truth)
                if _same_event_scope(truth, prediction)
                and truth.start_time <= prediction.alert_time <= truth.end_time + grace
            ),
            key=lambda index: (
                abs((prediction.alert_time - ground_truth[index].start_time).total_seconds()),
                ground_truth[index].event_id,
            ),
        )

    truth_to_prediction: dict[int, int] = {}
    prediction_to_truth: dict[int, int] = {}

    for starting_prediction in prediction_order:
        if starting_prediction in prediction_to_truth:
            continue
        queue = deque([starting_prediction])
        visited_predictions = {starting_prediction}
        parent_prediction_by_truth: dict[int, int] = {}
        free_truth: int | None = None

        while queue and free_truth is None:
            prediction_index = queue.popleft()
            for truth_index in candidate_truth[prediction_index]:
                if truth_index in parent_prediction_by_truth:
                    continue
                parent_prediction_by_truth[truth_index] = prediction_index
                occupying_prediction = truth_to_prediction.get(truth_index)
                if occupying_prediction is None:
                    free_truth = truth_index
                    break
                if occupying_prediction not in visited_predictions:
                    visited_predictions.add(occupying_prediction)
                    queue.append(occupying_prediction)

        while free_truth is not None:
            prediction_index = parent_prediction_by_truth[free_truth]
            previous_truth = prediction_to_truth.get(prediction_index)
            truth_to_prediction[free_truth] = prediction_index
            prediction_to_truth[prediction_index] = free_truth
            free_truth = previous_truth

    return prediction_to_truth


def score_events(
    ground_truth: list[GroundTruthEvent],
    predictions: list[PredictedEvent],
    *,
    camera_hours: float,
    grace_seconds: float = MAX_P95_ALERT_LATENCY_SECONDS,
) -> dict[str, Any]:
    """One-to-one match alerts to episodes and return publication-facing event metrics."""
    if not math.isfinite(camera_hours) or camera_hours <= 0:
        raise ValueError("camera_hours must be a finite value greater than zero")
    if not math.isfinite(grace_seconds) or grace_seconds < 0:
        raise ValueError("grace_seconds must be a finite non-negative value")

    matches: list[dict[str, Any]] = []
    grace = timedelta(seconds=grace_seconds)
    prediction_to_truth = _maximum_event_matching(ground_truth, predictions, grace)
    matched_truth = set(prediction_to_truth.values())

    for prediction_index, truth_index in sorted(
        prediction_to_truth.items(),
        key=lambda item: (predictions[item[0]].alert_time, predictions[item[0]].event_id),
    ):
        prediction = predictions[prediction_index]
        truth = ground_truth[truth_index]
        matches.append(
            {
                "ground_truth_event_id": truth.event_id,
                "predicted_event_id": prediction.event_id,
                "alert_latency_seconds": (prediction.alert_time - truth.start_time).total_seconds(),
            }
        )

    false_positive_ids = sorted(
        prediction.event_id
        for prediction_index, prediction in enumerate(predictions)
        if prediction_index not in prediction_to_truth
    )
    false_negative_ids = sorted(
        truth.event_id
        for truth_index, truth in enumerate(ground_truth)
        if truth_index not in matched_truth
    )
    true_positives = len(matches)
    false_positives = len(false_positive_ids)
    false_negatives = len(false_negative_ids)
    precision_denominator = true_positives + false_positives
    recall_denominator = true_positives + false_negatives
    precision = true_positives / precision_denominator if precision_denominator else None
    recall = true_positives / recall_denominator if recall_denominator else None
    f1 = (
        2 * precision * recall / (precision + recall)
        if precision is not None and recall is not None and precision + recall > 0
        else None
    )
    latencies = [float(match["alert_latency_seconds"]) for match in matches]
    p50_latency = percentile(latencies, 0.50)
    p95_latency = percentile(latencies, 0.95)
    false_alert_rate = false_positives / camera_hours
    missed_violation_rate = false_negatives / camera_hours

    checks = {
        "event_precision": {
            "value": precision,
            "operator": ">=",
            "target": MIN_EVENT_PRECISION,
            "passed": precision is not None and precision >= MIN_EVENT_PRECISION,
        },
        "event_recall": {
            "value": recall,
            "operator": ">=",
            "target": MIN_EVENT_RECALL,
            "passed": recall is not None and recall >= MIN_EVENT_RECALL,
        },
        "false_alerts_per_camera_hour": {
            "value": false_alert_rate,
            "operator": "<=",
            "target": MAX_FALSE_ALERTS_PER_CAMERA_HOUR,
            "passed": false_alert_rate <= MAX_FALSE_ALERTS_PER_CAMERA_HOUR,
        },
        "alert_latency_p95_seconds": {
            "value": p95_latency,
            "operator": "<=",
            "target": MAX_P95_ALERT_LATENCY_SECONDS,
            "passed": p95_latency is not None and p95_latency <= MAX_P95_ALERT_LATENCY_SECONDS,
        },
    }

    return {
        "counts": {
            "ground_truth": len(ground_truth),
            "predictions": len(predictions),
            "true_positives": true_positives,
            "false_positives": false_positives,
            "false_negatives": false_negatives,
        },
        "metrics": {
            "precision": precision,
            "recall": recall,
            "f1": f1,
            "false_alerts_per_camera_hour": false_alert_rate,
            "missed_violations_per_camera_hour": missed_violation_rate,
            "alert_latency_p50_seconds": p50_latency,
            "alert_latency_p95_seconds": p95_latency,
        },
        "matches": matches,
        "false_positive_event_ids": false_positive_ids,
        "false_negative_event_ids": false_negative_ids,
        "acceptance": {
            "checks": checks,
            "all_passed": all(check["passed"] for check in checks.values()),
        },
    }


def file_sha256(path: str | Path) -> str:
    digest = hashlib.sha256()
    with Path(path).open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--ground-truth", required=True, help="Locked ground-truth event CSV")
    parser.add_argument("--predictions", required=True, help="Exported system event CSV")
    parser.add_argument("--camera-hours", required=True, type=float)
    parser.add_argument("--grace-seconds", type=float, default=MAX_P95_ALERT_LATENCY_SECONDS)
    parser.add_argument("--output", required=True)
    parser.add_argument("--require-pass", action="store_true", help="Exit non-zero when an acceptance target fails")
    return parser.parse_args()


def main():
    args = parse_args()
    truth_path = Path(args.ground_truth).resolve()
    predictions_path = Path(args.predictions).resolve()
    result = score_events(
        read_ground_truth(truth_path),
        read_predictions(predictions_path),
        camera_hours=args.camera_hours,
        grace_seconds=args.grace_seconds,
    )
    payload = {
        "evaluated_at": datetime.now(timezone.utc).isoformat(),
        "ground_truth": str(truth_path),
        "ground_truth_sha256": file_sha256(truth_path),
        "predictions": str(predictions_path),
        "predictions_sha256": file_sha256(predictions_path),
        "camera_hours": args.camera_hours,
        "grace_seconds": args.grace_seconds,
        **result,
    }
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    if args.require_pass and not result["acceptance"]["all_passed"]:
        raise SystemExit(2)


if __name__ == "__main__":
    main()
