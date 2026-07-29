"""Evaluate one checkpoint on a locked validation or test split."""

import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import ultralytics
from ultralytics import YOLO


REQUIRED_CLASS_NAMES = {"person", "helmet", "safety-vest"}


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", required=True)
    parser.add_argument("--data", required=True)
    parser.add_argument("--split", choices=["val", "test"], default="test")
    parser.add_argument("--device", default="0")
    parser.add_argument("--imgsz", type=int, default=640)
    parser.add_argument("--output", required=True)
    return parser.parse_args()


def file_sha256(path: str | Path) -> str:
    """Return a content digest without loading a model or dataset manifest into memory."""
    digest = hashlib.sha256()
    with Path(path).open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def normalize_class_names(names: dict[int, str] | list[str]) -> dict[int, str]:
    if isinstance(names, dict):
        return {int(class_id): str(name) for class_id, name in names.items()}
    return {class_id: str(name) for class_id, name in enumerate(names)}


def build_per_class_metrics(metrics: Any, class_names: dict[int, str]) -> list[dict[str, Any]]:
    """Extract class-aware box metrics while making absent test classes explicit."""
    box_metrics = metrics.box
    result_index_by_class = {
        int(class_id): result_index
        for result_index, class_id in enumerate(box_metrics.ap_class_index)
    }
    target_counts = list(metrics.nt_per_class)
    rows: list[dict[str, Any]] = []

    for class_id, class_name in sorted(class_names.items()):
        result_index = result_index_by_class.get(class_id)
        row: dict[str, Any] = {
            "class_id": class_id,
            "class_name": class_name,
            "targets": int(target_counts[class_id]) if class_id < len(target_counts) else 0,
            "precision": None,
            "recall": None,
            "f1": None,
            "ap50": None,
            "ap50_95": None,
        }
        if result_index is not None:
            precision, recall, ap50, ap50_95 = box_metrics.class_result(result_index)
            f1_values = list(box_metrics.f1)
            row.update(
                precision=float(precision),
                recall=float(recall),
                f1=float(f1_values[result_index]),
                ap50=float(ap50),
                ap50_95=float(ap50_95),
            )
        rows.append(row)
    return rows


def main():
    args = parse_args()
    model_path = Path(args.model).resolve()
    data_path = Path(args.data).resolve()

    model = YOLO(args.model)
    metrics = model.val(
        data=args.data,
        split=args.split,
        device=args.device,
        imgsz=args.imgsz,
        plots=True,
        save_json=True,
    )
    class_names = normalize_class_names(model.names)
    missing_classes = sorted(REQUIRED_CLASS_NAMES - set(class_names.values()))
    if missing_classes:
        raise SystemExit(f"Model is missing required classes: {', '.join(missing_classes)}")

    payload = {
        "evaluated_at": datetime.now(timezone.utc).isoformat(),
        "ultralytics": ultralytics.__version__,
        "model": str(model_path),
        "model_sha256": file_sha256(model_path),
        "data": str(data_path),
        "data_sha256": file_sha256(data_path),
        "split": args.split,
        "imgsz": args.imgsz,
        "device": args.device,
        "metrics": {key: float(value) for key, value in metrics.results_dict.items()},
        "per_class": build_per_class_metrics(metrics, class_names),
        "speed_ms_per_image": {
            key: float(value)
            for key, value in metrics.speed.items()
        },
        "class_names": class_names,
    }
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")


if __name__ == "__main__":
    main()
