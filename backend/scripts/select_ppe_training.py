"""Build a repeatable vest-rich training list from a prepared SH17 view.

Only training membership changes. Validation and test membership are retained.
This public dataset has no person ground truth and is exploratory only.
"""

import argparse
import hashlib
import json
import random
from pathlib import Path

import yaml


def select_training(data: Path, seed: int = 42, negatives: int = 500) -> dict:
    data = data.resolve()
    config = yaml.safe_load(data.read_text(encoding="utf-8"))
    root = Path(config["path"]).resolve()
    names = config["names"]
    if names.get(10) != "helmet" or names.get(16) != "safety-vest":
        raise ValueError("Expected the prepared SH17 class schema")
    buckets: dict[str, list[Path]] = {"vest": [], "helmet_only": [], "background": []}
    for image in sorted((root / "images/train").rglob("*")):
        if not image.is_file():
            continue
        label = root / "labels/train" / image.relative_to(root / "images/train").with_suffix(".txt")
        if not label.is_file():
            raise ValueError(f"Missing label: {label}")
        ids = {int(row.split()[0]) for row in label.read_text().splitlines() if row.strip()}
        bucket = "vest" if 16 in ids else "helmet_only" if 10 in ids else "background"
        buckets[bucket].append(image)
    if not buckets["vest"]:
        raise ValueError("No vest-positive training images")
    rng = random.Random(seed)
    selected = list(buckets["vest"])
    selected += rng.sample(buckets["helmet_only"], min(len(selected), len(buckets["helmet_only"])))
    selected += rng.sample(buckets["background"], min(negatives, len(buckets["background"])))
    selected.sort()
    output_yaml = root / "data-focused.yaml"
    split_file = root / "focused-train.txt"
    report_file = root / "focused-selection.json"
    if any(path.exists() for path in (output_yaml, split_file, report_file)):
        raise FileExistsError("Selection already exists; preserve it and use a new dataset version")
    split_text = "".join(f"{image.as_posix()}\n" for image in selected)
    split_file.write_text(split_text, encoding="utf-8", newline="\n")
    config["train"] = split_file.as_posix()
    output_yaml.write_text(yaml.safe_dump(config, sort_keys=False), encoding="utf-8")
    report = {
        "seed": seed, "available_images": {key: len(value) for key, value in buckets.items()},
        "selected_images": len(selected), "selected_vest_images": len(buckets["vest"]),
        "list_sha256": hashlib.sha256(split_file.read_bytes()).hexdigest(),
        "validation_test_membership": "unchanged from prepared dataset",
        "limitations": ["No person ground truth", "Public source splits; scene leakage may remain",
                         "Vest includes reflective jackets and coveralls; colors are not labeled"],
    }
    report_file.write_text(json.dumps(report, indent=2), encoding="utf-8")
    return report


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data", type=Path, required=True)
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()
    print(json.dumps(select_training(args.data, args.seed), indent=2))
