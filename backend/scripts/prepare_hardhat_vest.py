"""Prepare a provenance-recorded helmet/vest YOLO dataset without changing its source.

The expected source layout is::

    images/{train,val,test}/...
    labels/{train,val,test}/...
    labels/classes.txt

Source class IDs are read from ``classes.txt``. The canonical output contains
only ``person``, ``helmet``, and ``safety-vest``; ``head`` annotations are
validated and deliberately omitted. Images are hard-linked when possible and
copied when the source and destination filesystems do not support hard links.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import shutil
import tempfile
from collections import Counter
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable
from uuid import uuid4


SPLITS = ("train", "val", "test")
IMAGE_SUFFIXES = {".bmp", ".jpeg", ".jpg", ".png", ".tif", ".tiff", ".webp"}
REQUIRED_SOURCE_CLASSES = {"helmet", "vest", "head", "person"}
CANONICAL_NAMES = ("person", "helmet", "safety-vest")
SH17_NAMES = (
    "person",
    "ear",
    "ear-mufs",
    "face",
    "face-guard",
    "face-mask",
    "foot",
    "tool",
    "glasses",
    "gloves",
    "helmet",
    "hands",
    "head",
    "medical-suit",
    "shoes",
    "safety-suit",
    "safety-vest",
)
GENERATOR_NAME = "prepare_hardhat_vest.py"
MANIFEST_SCHEMA_VERSION = 1
BOUNDARY_TOLERANCE = 1e-6


class DatasetPreparationError(ValueError):
    """Raised when source data or an output target violates the contract."""


@dataclass(frozen=True)
class YoloObject:
    source_class: str
    coordinates: tuple[str, str, str, str]


@dataclass(frozen=True)
class SourceSample:
    split: str
    relative_image: Path
    image_path: Path
    objects: tuple[YoloObject, ...]


@dataclass(frozen=True)
class DatasetScan:
    source_names: tuple[str, ...]
    samples_by_split: dict[str, tuple[SourceSample, ...]]
    deduplication: dict[str, object]


@dataclass(frozen=True)
class OutputVariant:
    name: str
    class_names: tuple[str, ...]
    class_ids: dict[str, int]
    dropped_classes: tuple[str, ...]


CANONICAL_VARIANT = OutputVariant(
    name="canonical",
    class_names=CANONICAL_NAMES,
    class_ids={"person": 0, "helmet": 1, "vest": 2},
    dropped_classes=("head",),
)
SH17_VARIANT = OutputVariant(
    name="sh17-compatible",
    class_names=SH17_NAMES,
    class_ids={"person": 0, "helmet": 10, "head": 12, "vest": 16},
    dropped_classes=(),
)


def _resolved_path(path: Path) -> Path:
    """Resolve a possibly nonexistent path without requiring its parent to exist."""

    return path.expanduser().resolve(strict=False)


def _is_within(path: Path, parent: Path) -> bool:
    try:
        path.relative_to(parent)
    except ValueError:
        return False
    return True


def _validate_separate_paths(source: Path, outputs: Iterable[Path]) -> None:
    resolved_outputs = [_resolved_path(path) for path in outputs]
    for output in resolved_outputs:
        if output == source or _is_within(output, source) or _is_within(source, output):
            raise DatasetPreparationError(
                f"Output must not equal, contain, or be contained by the source: {output}"
            )

    for index, first in enumerate(resolved_outputs):
        for second in resolved_outputs[index + 1 :]:
            if first == second or _is_within(first, second) or _is_within(second, first):
                raise DatasetPreparationError(f"Output directories must not overlap: {first}, {second}")


def _read_source_classes(source: Path) -> tuple[str, ...]:
    classes_path = source / "labels" / "classes.txt"
    if not classes_path.is_file() or classes_path.is_symlink():
        raise DatasetPreparationError(f"Missing regular class file: {classes_path}")

    names = tuple(
        line.strip().casefold()
        for line in classes_path.read_text(encoding="utf-8-sig").splitlines()
    )
    if any(not name for name in names):
        raise DatasetPreparationError("labels/classes.txt must not contain blank class names")
    if len(names) != len(set(names)):
        raise DatasetPreparationError("labels/classes.txt contains duplicate class names")
    if set(names) != REQUIRED_SOURCE_CLASSES:
        missing = sorted(REQUIRED_SOURCE_CLASSES - set(names))
        unexpected = sorted(set(names) - REQUIRED_SOURCE_CLASSES)
        raise DatasetPreparationError(
            "labels/classes.txt must contain exactly helmet, vest, head, and person "
            f"(missing={missing}, unexpected={unexpected})"
        )
    return names


def _regular_files(root: Path, suffixes: set[str]) -> list[Path]:
    files: list[Path] = []
    for path in root.rglob("*"):
        if path.is_symlink():
            raise DatasetPreparationError(f"Symbolic links are not allowed in dataset inputs: {path}")
        if path.is_file() and path.suffix.casefold() in suffixes:
            files.append(path)
    return sorted(files, key=lambda item: item.relative_to(root).as_posix().casefold())


def _parse_label_file(label_path: Path, source_names: tuple[str, ...]) -> tuple[YoloObject, ...]:
    objects: list[YoloObject] = []
    for line_number, raw_line in enumerate(
        label_path.read_text(encoding="utf-8-sig").splitlines(), start=1
    ):
        line = raw_line.strip()
        if not line:
            continue
        fields = line.split()
        if len(fields) != 5:
            raise DatasetPreparationError(
                f"{label_path}:{line_number}: expected five YOLO fields, found {len(fields)}"
            )
        try:
            class_id = int(fields[0])
        except ValueError as exc:
            raise DatasetPreparationError(
                f"{label_path}:{line_number}: class ID must be an integer"
            ) from exc
        if class_id < 0 or class_id >= len(source_names):
            raise DatasetPreparationError(
                f"{label_path}:{line_number}: class ID {class_id} is outside 0..{len(source_names) - 1}"
            )

        try:
            center_x, center_y, width, height = (float(value) for value in fields[1:])
        except ValueError as exc:
            raise DatasetPreparationError(
                f"{label_path}:{line_number}: box coordinates must be numbers"
            ) from exc
        values = (center_x, center_y, width, height)
        if not all(math.isfinite(value) for value in values):
            raise DatasetPreparationError(
                f"{label_path}:{line_number}: box coordinates must be finite"
            )
        if not 0.0 <= center_x <= 1.0 or not 0.0 <= center_y <= 1.0:
            raise DatasetPreparationError(
                f"{label_path}:{line_number}: box center must be within normalized image bounds"
            )
        if not 0.0 < width <= 1.0 or not 0.0 < height <= 1.0:
            raise DatasetPreparationError(
                f"{label_path}:{line_number}: box width and height must be in (0, 1]"
            )
        if (
            center_x - width / 2 < -BOUNDARY_TOLERANCE
            or center_x + width / 2 > 1 + BOUNDARY_TOLERANCE
            or center_y - height / 2 < -BOUNDARY_TOLERANCE
            or center_y + height / 2 > 1 + BOUNDARY_TOLERANCE
        ):
            raise DatasetPreparationError(
                f"{label_path}:{line_number}: box extends outside normalized image bounds"
            )

        objects.append(
            YoloObject(
                source_class=source_names[class_id],
                coordinates=(fields[1], fields[2], fields[3], fields[4]),
            )
        )
    return tuple(objects)


def _deduplicate_samples(
    samples_by_split: dict[str, tuple[SourceSample, ...]],
) -> tuple[dict[str, tuple[SourceSample, ...]], dict[str, object]]:
    """Quarantine conflicting annotations; deduplicate consistent images."""

    priority = {"test": 0, "val": 1, "train": 2}
    groups: dict[str, list[SourceSample]] = {}
    for split in SPLITS:
        for sample in samples_by_split[split]:
            groups.setdefault(file_sha256(sample.image_path), []).append(sample)

    removed_ids: set[tuple[str, Path]] = set()
    removed_by_split: dict[str, dict[str, object]] = {
        split: {
            "images": 0,
            "label_files": 0,
            "source_objects": 0,
            "labels_by_class": Counter(),
        }
        for split in SPLITS
    }
    duplicate_groups = 0
    cross_split_groups = 0
    conflicts: list[dict[str, object]] = []
    for image_hash, samples in groups.items():
        if len(samples) < 2:
            continue
        duplicate_groups += 1
        if len({sample.split for sample in samples}) > 1:
            cross_split_groups += 1
        ordered = sorted(
            samples,
            key=lambda sample: (
                priority[sample.split],
                sample.relative_image.as_posix().casefold(),
            ),
        )
        signatures = {
            tuple(sorted(
                (item.source_class, *(round(float(value), 6) for value in item.coordinates))
                for item in sample.objects
            ))
            for sample in ordered
        }
        if len(signatures) > 1:
            conflicts.append({
                "sha256": image_hash,
                "images": [f"{item.split}/{item.relative_image.as_posix()}" for item in ordered],
            })
        removed_samples = ordered if len(signatures) > 1 else ordered[1:]
        for sample in removed_samples:
            removed_ids.add((sample.split, sample.relative_image))
            row = removed_by_split[sample.split]
            row["images"] += 1
            row["label_files"] += 1
            row["source_objects"] += len(sample.objects)
            row["labels_by_class"].update(item.source_class for item in sample.objects)

    deduplicated: dict[str, tuple[SourceSample, ...]] = {}
    for split in SPLITS:
        deduplicated[split] = tuple(
            sample
            for sample in samples_by_split[split]
            if (sample.split, sample.relative_image) not in removed_ids
        )
        if not deduplicated[split]:
            raise DatasetPreparationError(
                f"Split {split} became empty after exact-image deduplication"
            )

    total_removed = sum(int(row["images"]) for row in removed_by_split.values())
    serializable_removed_by_split = {
        split: {
            **row,
            "labels_by_class": dict(sorted(row["labels_by_class"].items())),
        }
        for split, row in removed_by_split.items()
    }
    return deduplicated, {
        "algorithm": "sha256",
        "split_priority": ["test", "val", "train"],
        "duplicate_groups": duplicate_groups,
        "cross_split_duplicate_groups": cross_split_groups,
        "conflicting_groups": conflicts,
        "conflicting_group_count": len(conflicts),
        "conflict_policy": "exclude all copies from output; keep source unchanged",
        "removed_images": total_removed,
        "removed_by_split": serializable_removed_by_split,
    }


def scan_source(source: str | Path) -> DatasetScan:
    """Validate and inventory the source dataset without writing to it."""

    source_path = Path(source).expanduser()
    if not source_path.is_dir() or source_path.is_symlink():
        raise DatasetPreparationError(f"Source must be an existing regular directory: {source_path}")
    source_path = source_path.resolve(strict=True)
    source_names = _read_source_classes(source_path)
    samples_by_split: dict[str, tuple[SourceSample, ...]] = {}

    for split in SPLITS:
        image_root = source_path / "images" / split
        label_root = source_path / "labels" / split
        if not image_root.is_dir() or image_root.is_symlink():
            raise DatasetPreparationError(f"Missing regular image split directory: {image_root}")
        if not label_root.is_dir() or label_root.is_symlink():
            raise DatasetPreparationError(f"Missing regular label split directory: {label_root}")

        image_paths = _regular_files(image_root, IMAGE_SUFFIXES)
        if not image_paths:
            raise DatasetPreparationError(f"Image split must not be empty: {image_root}")
        label_paths = _regular_files(label_root, {".txt"})
        label_by_relative = {
            path.relative_to(label_root).with_suffix(".txt"): path for path in label_paths
        }
        if len(label_by_relative) != len(label_paths):
            raise DatasetPreparationError(f"Duplicate label paths after normalization in {label_root}")

        image_by_label: dict[Path, Path] = {}
        for image_path in image_paths:
            relative_image = image_path.relative_to(image_root)
            expected_label = relative_image.with_suffix(".txt")
            previous = image_by_label.get(expected_label)
            if previous is not None:
                raise DatasetPreparationError(
                    f"Images {previous} and {image_path} would share label {expected_label}"
                )
            image_by_label[expected_label] = image_path

        missing_labels = sorted(
            set(image_by_label) - set(label_by_relative), key=lambda item: item.as_posix()
        )
        extra_labels = sorted(
            set(label_by_relative) - set(image_by_label), key=lambda item: item.as_posix()
        )
        if missing_labels or extra_labels:
            raise DatasetPreparationError(
                f"Unpaired files in split {split}: missing_labels="
                f"{[item.as_posix() for item in missing_labels]}, extra_labels="
                f"{[item.as_posix() for item in extra_labels]}"
            )

        samples: list[SourceSample] = []
        for expected_label, image_path in sorted(
            image_by_label.items(), key=lambda item: item[0].as_posix().casefold()
        ):
            samples.append(
                SourceSample(
                    split=split,
                    relative_image=image_path.relative_to(image_root),
                    image_path=image_path,
                    objects=_parse_label_file(label_by_relative[expected_label], source_names),
                )
            )
        samples_by_split[split] = tuple(samples)

    deduplicated, deduplication = _deduplicate_samples(samples_by_split)
    return DatasetScan(
        source_names=source_names,
        samples_by_split=deduplicated,
        deduplication=deduplication,
    )


def file_sha256(path: str | Path) -> str:
    digest = hashlib.sha256()
    with Path(path).open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _target_state(target: Path, replace_generated: bool) -> str:
    if not target.exists():
        return "missing"
    if not target.is_dir() or target.is_symlink():
        raise DatasetPreparationError(f"Output must be a regular directory path: {target}")
    if next(target.iterdir(), None) is None:
        return "empty"
    if not replace_generated:
        raise DatasetPreparationError(
            f"Refusing nonempty output directory {target}; use --replace-generated only for a prior generated output"
        )

    manifest_path = target / "manifest.json"
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise DatasetPreparationError(
            f"Refusing to replace unrecognized output directory without a valid manifest: {target}"
        ) from exc
    if (
        manifest.get("generator") != GENERATOR_NAME
        or manifest.get("schema_version") != MANIFEST_SCHEMA_VERSION
    ):
        raise DatasetPreparationError(f"Refusing to replace output not created by {GENERATOR_NAME}: {target}")
    return "generated"


def _write_data_yaml(root: Path, class_names: tuple[str, ...]) -> None:
    lines = [
        f"path: {json.dumps(root.as_posix())}",
        "train: images/train",
        "val: images/val",
        "test: images/test",
        "",
        "names:",
    ]
    lines.extend(f"  {class_id}: {json.dumps(name)}" for class_id, name in enumerate(class_names))
    (root / "data.yaml").write_text("\n".join(lines) + "\n", encoding="utf-8")


def _link_or_copy(source: Path, destination: Path) -> str:
    destination.parent.mkdir(parents=True, exist_ok=True)
    try:
        os.link(source, destination)
    except OSError:
        shutil.copy2(source, destination)
        return "copied"
    return "hardlinked"


def _dataset_counts(scan: DatasetScan, variant: OutputVariant) -> dict[str, object]:
    split_counts: dict[str, object] = {}
    total_source = Counter[str]()
    total_output = Counter[str]()
    total_images = 0

    for split in SPLITS:
        source_labels = Counter[str]()
        output_labels = Counter[str]()
        samples = scan.samples_by_split[split]
        for sample in samples:
            for item in sample.objects:
                source_labels[item.source_class] += 1
                if item.source_class in variant.class_ids:
                    output_labels[variant.class_names[variant.class_ids[item.source_class]]] += 1
        total_source.update(source_labels)
        total_output.update(output_labels)
        total_images += len(samples)
        split_counts[split] = {
            "images": len(samples),
            "label_files": len(samples),
            "source_objects": sum(source_labels.values()),
            "output_objects": sum(output_labels.values()),
            "output_labels_by_class": dict(sorted(output_labels.items())),
            "dropped_labels": {
                name: source_labels[name] for name in variant.dropped_classes
            },
        }

    return {
        "images": total_images,
        "label_files": total_images,
        "source_objects": sum(total_source.values()),
        "output_objects": sum(total_output.values()),
        "output_labels_by_class": dict(sorted(total_output.items())),
        "dropped_labels": {
            name: total_source[name] for name in variant.dropped_classes
        },
        "splits": split_counts,
    }


def _write_variant(
    staging_root: Path,
    final_root: Path,
    scan: DatasetScan,
    variant: OutputVariant,
    source_url: str,
    source_license: str,
    source_archive: dict[str, str] | None,
    created_at: str,
) -> dict[str, object]:
    transfer_counts = Counter[str]()
    for split in SPLITS:
        for sample in scan.samples_by_split[split]:
            image_destination = staging_root / "images" / split / sample.relative_image
            transfer_counts[_link_or_copy(sample.image_path, image_destination)] += 1

            label_destination = (
                staging_root / "labels" / split / sample.relative_image.with_suffix(".txt")
            )
            label_destination.parent.mkdir(parents=True, exist_ok=True)
            output_rows = [
                f"{variant.class_ids[item.source_class]} {' '.join(item.coordinates)}"
                for item in sample.objects
                if item.source_class in variant.class_ids
            ]
            label_destination.write_text(
                "\n".join(output_rows) + ("\n" if output_rows else ""),
                encoding="utf-8",
            )

    manifest: dict[str, object] = {
        "schema_version": MANIFEST_SCHEMA_VERSION,
        "generator": GENERATOR_NAME,
        "created_at": created_at,
        "variant": variant.name,
        "source": {
            "url": source_url,
            "license": source_license,
            "archive": source_archive,
        },
        "source_classes": [
            {"id": class_id, "name": name} for class_id, name in enumerate(scan.source_names)
        ],
        "output_classes": [
            {"id": class_id, "name": name} for class_id, name in enumerate(variant.class_names)
        ],
        "class_remap": {
            name: class_id for name, class_id in sorted(variant.class_ids.items())
        },
        "dropped_classes": list(variant.dropped_classes),
        "deduplication": scan.deduplication,
        "counts": _dataset_counts(scan, variant),
        "image_transfer": {
            "hardlinked": transfer_counts["hardlinked"],
            "copied": transfer_counts["copied"],
        },
    }
    (staging_root / "manifest.json").write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False, sort_keys=True) + "\n",
        encoding="utf-8",
    )

    # The staging directory has a temporary name, so data.yaml must reference
    # the final path that will exist after the atomic rename.
    _write_data_yaml(staging_root, variant.class_names)
    data_yaml = (staging_root / "data.yaml").read_text(encoding="utf-8")
    staging_path_line = f"path: {json.dumps(staging_root.as_posix())}"
    final_path_line = f"path: {json.dumps(final_root.as_posix())}"
    if staging_path_line not in data_yaml:
        raise RuntimeError("Generated data.yaml did not contain its staging path")
    (staging_root / "data.yaml").write_text(
        data_yaml.replace(staging_path_line, final_path_line, 1),
        encoding="utf-8",
    )
    return manifest


def _commit_staging(staging: Path, target: Path, state: str) -> None:
    if state == "missing":
        staging.replace(target)
        return
    if state == "empty":
        target.rmdir()
        try:
            staging.replace(target)
        except OSError:
            target.mkdir(parents=True, exist_ok=True)
            raise
        return

    backup = target.parent / f".{target.name}.backup-{uuid4().hex}"
    target.replace(backup)
    try:
        staging.replace(target)
    except OSError:
        backup.replace(target)
        raise
    shutil.rmtree(backup)


def prepare_dataset(
    source: str | Path,
    output: str | Path,
    *,
    source_url: str,
    source_license: str,
    source_archive_path: str | Path | None = None,
    sh17_output: str | Path | None = None,
    replace_generated: bool = False,
) -> dict[str, dict[str, object]]:
    """Validate a source dataset and materialize canonical/evaluation views."""

    if not source_url.strip():
        raise DatasetPreparationError("source_url must not be blank")
    if not source_license.strip():
        raise DatasetPreparationError("source_license must not be blank")

    source_path = Path(source).expanduser().resolve(strict=True)
    targets: list[tuple[Path, OutputVariant]] = [
        (_resolved_path(Path(output)), CANONICAL_VARIANT)
    ]
    if sh17_output is not None:
        targets.append((_resolved_path(Path(sh17_output)), SH17_VARIANT))
    _validate_separate_paths(source_path, (target for target, _ in targets))
    states = {
        target: _target_state(target, replace_generated) for target, _ in targets
    }

    scan = scan_source(source_path)
    archive_metadata: dict[str, str] | None = None
    if source_archive_path is not None:
        archive_path = Path(source_archive_path).expanduser()
        if not archive_path.is_file() or archive_path.is_symlink():
            raise DatasetPreparationError(f"Source archive must be a regular file: {archive_path}")
        archive_metadata = {
            "filename": archive_path.name,
            "sha256": file_sha256(archive_path),
        }

    for target, _ in targets:
        target.parent.mkdir(parents=True, exist_ok=True)

    created_at = datetime.now(timezone.utc).isoformat()
    staged: list[tuple[Path, Path, str]] = []
    manifests: dict[str, dict[str, object]] = {}
    try:
        for target, variant in targets:
            staging = Path(
                tempfile.mkdtemp(prefix=f".{target.name}.staging-", dir=target.parent)
            )
            staged.append((staging, target, states[target]))
            manifests[variant.name] = _write_variant(
                staging,
                target,
                scan,
                variant,
                source_url.strip(),
                source_license.strip(),
                archive_metadata,
                created_at,
            )
        for staging, target, state in staged:
            _commit_staging(staging, target, state)
    finally:
        for staging, _, _ in staged:
            if staging.exists():
                shutil.rmtree(staging)

    return manifests


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--source-url", required=True)
    parser.add_argument("--license", dest="source_license", required=True)
    parser.add_argument(
        "--source-archive",
        type=Path,
        help="Optional downloaded archive whose SHA-256 will be recorded",
    )
    parser.add_argument(
        "--sh17-output",
        type=Path,
        help="Optional sibling view retaining the full SH17 class schema",
    )
    parser.add_argument(
        "--replace-generated",
        action="store_true",
        help="Replace only a nonempty output carrying this tool's valid manifest",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    try:
        manifests = prepare_dataset(
            args.source,
            args.output,
            source_url=args.source_url,
            source_license=args.source_license,
            source_archive_path=args.source_archive,
            sh17_output=args.sh17_output,
            replace_generated=args.replace_generated,
        )
    except (DatasetPreparationError, OSError) as exc:
        raise SystemExit(f"Dataset preparation failed: {exc}") from exc

    print(
        json.dumps(
            {
                name: {
                    "images": manifest["counts"]["images"],
                    "output_objects": manifest["counts"]["output_objects"],
                    "dropped_head": manifest["counts"]["dropped_labels"].get("head", 0),
                }
                for name, manifest in manifests.items()
            },
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
