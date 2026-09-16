"""Create a deterministic orange-focused training list from prepared SH17 data.

Color selection is an HSV heuristic over existing ground-truth PPE boxes, not
a new color annotation. Validation and test membership are never changed.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import random
import shutil
from pathlib import Path

import cv2
import yaml

try:
    from scripts.select_orange_test_slice import orange_fraction
except ModuleNotFoundError:
    from select_orange_test_slice import orange_fraction


PPE_CLASS_IDS = {10: "helmet", 16: "safety-vest"}


def select_training(
    data: Path,
    output: Path,
    *,
    target_images: int = 5000,
    negatives: int = 500,
    minimum_fraction: float = 0.25,
    seed: int = 42,
    materialize: bool = False,
) -> dict:
    """Freeze a unique-image orange-focused train list and provenance report."""
    if target_images < 1 or negatives < 0 or negatives >= target_images:
        raise ValueError("target_images must be positive and negatives must be smaller")
    if not 0 < minimum_fraction <= 1:
        raise ValueError("minimum_fraction must be in (0, 1]")
    if output.exists():
        raise FileExistsError("Preserve the frozen selection; use a new output directory")

    data = data.resolve()
    config = yaml.safe_load(data.read_text(encoding="utf-8"))
    root = Path(config["path"]).resolve()
    names = config["names"]
    if names.get(10) != "helmet" or names.get(16) != "safety-vest":
        raise ValueError("Expected the prepared SH17 class mapping")
    if config["train"] != "images/train":
        raise ValueError("Selection must start from the complete prepared train split")

    orange_vest: list[Path] = []
    orange_helmet: list[Path] = []
    negatives_pool: list[Path] = []
    match_counts = {"helmet": 0, "safety-vest": 0}
    cv2.setNumThreads(1)
    image_root = root / "images/train"
    label_root = root / "labels/train"
    for image_path in sorted(path for path in image_root.rglob("*") if path.is_file()):
        label_path = label_root / image_path.relative_to(image_root).with_suffix(".txt")
        if not label_path.is_file():
            raise ValueError(f"Missing label: {label_path}")
        rows = [line.split() for line in label_path.read_text().splitlines() if line.strip()]
        ppe = [
            (int(row[0]), [float(value) for value in row[1:]])
            for row in rows
            if int(row[0]) in PPE_CLASS_IDS
        ]
        if not ppe:
            negatives_pool.append(image_path)
            continue
        image = cv2.imread(str(image_path))
        if image is None:
            raise ValueError(f"Unreadable image: {image_path}")
        matches = [
            (class_id, orange_fraction(image, box))
            for class_id, box in ppe
        ]
        matched_classes = {
            class_id for class_id, fraction in matches if fraction >= minimum_fraction
        }
        for class_id, fraction in matches:
            if fraction >= minimum_fraction:
                match_counts[PPE_CLASS_IDS[class_id]] += 1
        if 16 in matched_classes:
            orange_vest.append(image_path)
        elif 10 in matched_classes:
            orange_helmet.append(image_path)

    positive_target = target_images - negatives
    if len(orange_vest) > positive_target:
        raise ValueError("Target is too small to retain every orange-like vest image")
    helmet_needed = positive_target - len(orange_vest)
    if helmet_needed > len(orange_helmet) or negatives > len(negatives_pool):
        raise ValueError("Not enough unique candidates for the requested selection")

    rng = random.Random(seed)
    selected_vest = list(orange_vest)
    selected_helmet = rng.sample(orange_helmet, helmet_needed)
    selected_negatives = rng.sample(negatives_pool, negatives)
    selected = sorted(selected_vest + selected_helmet + selected_negatives)
    if len(selected) != len(set(selected)) or len(selected) != target_images:
        raise RuntimeError("Selection must contain the requested number of unique images")

    output.mkdir(parents=True)
    train_list = output / "train.txt"
    train_list.write_text(
        "".join(f"{path.as_posix()}\n" for path in selected),
        encoding="utf-8",
        newline="\n",
    )
    focused_config = dict(config)
    transfer = {"hardlinked": 0, "copied": 0}
    if materialize:
        materialized_root = output / "dataset"
        split_sources = {
            "train": selected,
            "val": sorted(path for path in (root / "images/val").rglob("*") if path.is_file()),
            "test": sorted(path for path in (root / "images/test").rglob("*") if path.is_file()),
        }
        for split, image_paths in split_sources.items():
            source_image_root = root / f"images/{split}"
            source_label_root = root / f"labels/{split}"
            for image_path in image_paths:
                relative_image = image_path.relative_to(source_image_root)
                source_label = source_label_root / relative_image.with_suffix(".txt")
                if not source_label.is_file():
                    raise ValueError(f"Missing label: {source_label}")
                for source, destination in (
                    (image_path, materialized_root / f"images/{split}" / relative_image),
                    (source_label, materialized_root / f"labels/{split}" / relative_image.with_suffix(".txt")),
                ):
                    destination.parent.mkdir(parents=True, exist_ok=True)
                    try:
                        os.link(source, destination)
                        transfer["hardlinked"] += 1
                    except OSError:
                        shutil.copy2(source, destination)
                        transfer["copied"] += 1
        focused_config["path"] = materialized_root.resolve().as_posix()
        focused_config["train"] = "images/train"
        focused_config["val"] = "images/val"
        focused_config["test"] = "images/test"
    else:
        focused_config["train"] = train_list.resolve().as_posix()
    yaml_path = output / "data.yaml"
    yaml_path.write_text(yaml.safe_dump(focused_config, sort_keys=False), encoding="utf-8")
    report = {
        "selection": "HSV heuristic inside existing train PPE boxes; no model predictions used",
        "seed": seed,
        "target_images": target_images,
        "selected_unique_images": len(selected),
        "selected_orange_vest_images": len(selected_vest),
        "selected_orange_helmet_images": len(selected_helmet),
        "selected_negative_images": len(selected_negatives),
        "available_orange_vest_images": len(orange_vest),
        "available_orange_helmet_only_images": len(orange_helmet),
        "available_negative_images": len(negatives_pool),
        "orange_like_objects_in_candidate_pool": match_counts,
        "hsv_lower": [3, 100, 80],
        "hsv_upper": [20, 255, 255],
        "minimum_fraction": minimum_fraction,
        "list_sha256": hashlib.sha256(train_list.read_bytes()).hexdigest(),
        "source_data_yaml_sha256": hashlib.sha256(data.read_bytes()).hexdigest(),
        "validation": config["val"],
        "test": config["test"],
        "materialized": materialize,
        "file_transfer": transfer,
        "limitations": [
            "HSV can include skin, backgrounds, rust, and warm yellow; not human color labels",
            "Negative images have no helmet or safety-vest annotation but are not curated orange decoys",
            "Public source split may contain related scenes and has no person ground truth",
        ],
    }
    (output / "selection.json").write_text(
        json.dumps(report, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    return report


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--target-images", type=int, default=5000)
    parser.add_argument("--negatives", type=int, default=500)
    parser.add_argument("--minimum-fraction", type=float, default=0.25)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--materialize", action="store_true")
    args = parser.parse_args()
    report = select_training(
        args.data,
        args.output,
        target_images=args.target_images,
        negatives=args.negatives,
        minimum_fraction=args.minimum_fraction,
        seed=args.seed,
        materialize=args.materialize,
    )
    print(json.dumps(report, indent=2, ensure_ascii=False))
