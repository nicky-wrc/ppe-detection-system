"""Compare PPE detections at a predeclared confidence threshold on held-out images.

Consumes custom-dataset Ultralytics predictions.json (category_id = class_id + 1).
This scores raw frame predictions, not hybrid person association or alert events.
"""

import argparse
import hashlib
import json
from collections import defaultdict
from pathlib import Path

from PIL import Image
import yaml


PPE_CLASSES = {10: "helmet", 16: "safety-vest"}


def box_iou(a: list[float], b: list[float]) -> float:
    """Compute IoU for pixel xyxy boxes."""
    overlap = max(0.0, min(a[2], b[2]) - max(a[0], b[0])) * max(0.0, min(a[3], b[3]) - max(a[1], b[1]))
    area_a = max(0.0, a[2] - a[0]) * max(0.0, a[3] - a[1])
    area_b = max(0.0, b[2] - b[0]) * max(0.0, b[3] - b[1])
    union = area_a + area_b - overlap
    return overlap / union if union else 0.0


def match_counts(truth: list[list[float]], predictions: list[dict], confidence: float, iou: float) -> dict:
    """Confidence-ordered, same-class, one-to-one matching for one image."""
    unmatched = set(range(len(truth)))
    tp, fp = 0, 0
    for prediction in sorted(predictions, key=lambda row: row["score"], reverse=True):
        if prediction["score"] < confidence:
            continue
        x, y, w, h = prediction["bbox"]
        box = [x, y, x + w, y + h]
        best = max(sorted(unmatched), key=lambda index: box_iou(box, truth[index]), default=None)
        if best is not None and box_iou(box, truth[best]) >= iou:
            tp += 1
            unmatched.remove(best)
        else:
            fp += 1
    return {"tp": tp, "fp": fp, "fn": len(unmatched)}


def score_predictions(prediction_file: Path, data: Path, confidence: float = 0.20,
                      iou: float = 0.50, image_list: Path | None = None) -> dict:
    """Score the prepared SH17 test split or an unchanged subset of that split."""
    if not 0 <= confidence <= 1 or not 0 < iou <= 1:
        raise ValueError("Invalid confidence or IoU threshold")
    config = yaml.safe_load(data.read_text(encoding="utf-8"))
    if any(config["names"].get(key) != value for key, value in PPE_CLASSES.items()):
        raise ValueError("Expected prepared SH17 class mapping")
    root = Path(config["path"]).resolve()
    test_root = root / "images/test"
    if image_list:
        images = [Path(line).resolve() for line in image_list.read_text(encoding="utf-8").splitlines() if line.strip()]
        if any(not path.is_relative_to(test_root) for path in images):
            raise ValueError("Slice images must belong to the prepared test split")
    else:
        images = sorted(path for path in test_root.rglob("*") if path.is_file())
    if not images or len(set(path.name for path in images)) != len(images):
        raise ValueError("Expected nonempty, unique test image file names")
    prediction_bytes = prediction_file.read_bytes()
    by_image: dict[str, dict[int, list]] = defaultdict(lambda: defaultdict(list))
    for row in json.loads(prediction_bytes):
        class_id = int(row["category_id"]) - 1
        if class_id in PPE_CLASSES:
            by_image[row["file_name"]][class_id].append(row)
    totals = {name: {"tp": 0, "fp": 0, "fn": 0} for name in PPE_CLASSES.values()}
    for image_path in images:
        with Image.open(image_path) as image:
            width, height = image.size
        label_path = root / "labels/test" / image_path.relative_to(test_root).with_suffix(".txt")
        truth: dict[int, list] = defaultdict(list)
        for line in label_path.read_text().splitlines():
            if not line.strip():
                continue
            class_value, *values = line.split()
            class_id = int(class_value)
            if class_id not in PPE_CLASSES:
                continue
            x, y, w, h = map(float, values)
            truth[class_id].append([(x - w / 2) * width, (y - h / 2) * height,
                                    (x + w / 2) * width, (y + h / 2) * height])
        for class_id, name in PPE_CLASSES.items():
            counts = match_counts(truth[class_id], by_image[image_path.name][class_id], confidence, iou)
            for key, value in counts.items():
                totals[name][key] += value
    for row in totals.values():
        tp, fp, fn = row["tp"], row["fp"], row["fn"]
        row["precision"] = tp / (tp + fp) if tp + fp else None
        row["recall"] = tp / (tp + fn) if tp + fn else None
        row["f1"] = 2 * tp / (2 * tp + fp + fn) if 2 * tp + fp + fn else None
    image_text = "".join(f"{path.as_posix()}\n" for path in images)
    return {"images": len(images), "confidence": confidence, "iou": iou,
            "predictions_sha256": hashlib.sha256(prediction_bytes).hexdigest(),
            "image_list_lf_sha256": hashlib.sha256(image_text.encode()).hexdigest(),
            "category_mapping": "Ultralytics custom dataset: category_id = SH17 class_id + 1",
            "matching": "Confidence-ordered one-to-one same-class matching at IoU >= threshold",
            "per_class": totals,
            "limitations": ["Raw frames only; no hybrid runtime, person association or temporal alerts",
                             "Dataset labels may be incomplete; no person evaluation",
                             "Color-selected slices score ALL labels in selected images"]}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--predictions", type=Path, required=True)
    parser.add_argument("--data", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--image-list", type=Path)
    args = parser.parse_args()
    if args.output.exists():
        raise SystemExit("Output exists; preserve the previous report")
    result = score_predictions(args.predictions, args.data, image_list=args.image_list)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(json.dumps(result, indent=2))
