"""Freeze an exploratory orange-like image slice without using model predictions.

This is an HSV heuristic over existing ground-truth PPE boxes, NOT a human
color annotation. All labels in each selected image remain in evaluation.
"""

import argparse
import hashlib
import json
from pathlib import Path

import cv2
import numpy as np
import yaml


def orange_fraction(image: np.ndarray, box: list[float]) -> float:
    """Measure orange-like pixels inside a normalized YOLO box (OpenCV HSV)."""
    height, width = image.shape[:2]
    x, y, w, h = box
    x1, y1 = max(0, int((x - w / 2) * width)), max(0, int((y - h / 2) * height))
    x2, y2 = min(width, int((x + w / 2) * width)), min(height, int((y + h / 2) * height))
    crop = image[y1:y2, x1:x2]
    if not crop.size:
        return 0.0
    hsv = cv2.cvtColor(crop, cv2.COLOR_BGR2HSV)
    mask = cv2.inRange(hsv, np.array([3, 100, 80], dtype=np.uint8),
                       np.array([20, 255, 255], dtype=np.uint8))
    return float(np.count_nonzero(mask) / mask.size)


def select_slice(data: Path, output: Path, minimum_fraction: float = 0.25) -> dict:
    """Select from prepared test images only, preserving every original label."""
    if not 0 < minimum_fraction <= 1:
        raise ValueError("minimum_fraction must be in (0, 1]")
    if output.exists():
        raise FileExistsError("Preserve the locked slice; use a new output directory")
    config = yaml.safe_load(data.read_text(encoding="utf-8"))
    root = Path(config["path"]).resolve()
    if config["names"].get(10) != "helmet" or config["names"].get(16) != "safety-vest":
        raise ValueError("Expected prepared SH17 class mapping")
    if config["test"] != "images/test":
        raise ValueError("Expected the prepared images/test split")
    rows = []
    object_counts = {"helmet": 0, "safety-vest": 0}
    cv2.setNumThreads(1)
    for image_path in sorted((root / "images/test").rglob("*")):
        if not image_path.is_file():
            continue
        label = root / "labels/test" / image_path.relative_to(root / "images/test").with_suffix(".txt")
        boxes = [line.split() for line in label.read_text().splitlines() if line.strip()]
        relevant = [(int(row[0]), [float(value) for value in row[1:]]) for row in boxes
                    if int(row[0]) in (10, 16)]
        if not relevant:
            continue
        image = cv2.imread(str(image_path))
        if image is None:
            raise ValueError(f"Unreadable image: {image_path}")
        matches = []
        for class_id, box in relevant:
            fraction = orange_fraction(image, box)
            if fraction >= minimum_fraction:
                name = config["names"][class_id]
                matches.append({"class_name": name, "box": box, "orange_fraction": fraction})
                object_counts[name] += 1
        if matches:
            rows.append({"image": image_path.as_posix(), "matches": matches})
    if not rows:
        raise ValueError("No orange-like test images found")
    output.mkdir(parents=True)
    selected = output / "test.txt"
    selected.write_text("".join(f"{row['image']}\n" for row in rows), encoding="utf-8", newline="\n")
    config["test"] = selected.resolve().as_posix()
    (output / "data.yaml").write_text(yaml.safe_dump(config, sort_keys=False), encoding="utf-8")
    report = {
        "selection": "Existing test PPE boxes; no predictions or trained-model scores used",
        "hsv_lower": [3, 100, 80], "hsv_upper": [20, 255, 255],
        "minimum_fraction": minimum_fraction, "images": len(rows),
        "orange_like_objects": object_counts,
        "list_sha256": hashlib.sha256(selected.read_bytes()).hexdigest(),
        "limitations": ["HSV can include skin, background and warm yellow; not human color labels",
                         "Evaluation scores every label in selected images, not just orange-like objects",
                         "Subset of public test set, not independent target-camera evidence"],
        "samples": rows,
    }
    (output / "selection.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    return {key: value for key, value in report.items() if key != "samples"}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    print(json.dumps(select_slice(args.data, args.output), indent=2))
