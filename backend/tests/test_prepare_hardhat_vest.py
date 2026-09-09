import hashlib
import json
import os
from pathlib import Path

import pytest

from scripts.prepare_hardhat_vest import DatasetPreparationError, prepare_dataset


SOURCE_LABEL = (
    "0 0.50 0.20 0.20 0.20\n"
    "1 0.50 0.55 0.40 0.50\n"
    "2 0.50 0.15 0.25 0.20\n"
    "3 0.50 0.50 0.90 1.00\n"
)


def make_source(root: Path) -> Path:
    source = root / "source"
    (source / "labels").mkdir(parents=True)
    (source / "labels" / "classes.txt").write_text(
        "helmet\nvest\nhead\nperson\n", encoding="utf-8"
    )
    for split in ("train", "val", "test"):
        (source / "images" / split).mkdir(parents=True)
        (source / "labels" / split).mkdir(parents=True)
        add_sample(source, split, f"{split}.jpg", split.encode(), SOURCE_LABEL)
    return source


def add_sample(source: Path, split: str, name: str, content: bytes, label: str) -> None:
    (source / "images" / split / name).write_bytes(content)
    (source / "labels" / split / Path(name).with_suffix(".txt")).write_text(
        label, encoding="utf-8"
    )


def test_prepare_remaps_drops_head_and_deduplicates_with_test_priority(tmp_path):
    source = make_source(tmp_path)
    add_sample(source, "train", "duplicate-test.jpg", b"test", SOURCE_LABEL)
    output = tmp_path / "canonical"
    sh17_output = tmp_path / "sh17"

    prepare_dataset(
        source,
        output,
        source_url="https://example.test/dataset.zip",
        source_license="CC BY 4.0",
        sh17_output=sh17_output,
    )

    assert not (output / "images" / "train" / "duplicate-test.jpg").exists()
    assert (output / "labels" / "train" / "train.txt").read_text(encoding="utf-8") == (
        "1 0.50 0.20 0.20 0.20\n"
        "2 0.50 0.55 0.40 0.50\n"
        "0 0.50 0.50 0.90 1.00\n"
    )
    assert (sh17_output / "labels" / "test" / "test.txt").read_text(encoding="utf-8") == (
        "10 0.50 0.20 0.20 0.20\n"
        "16 0.50 0.55 0.40 0.50\n"
        "12 0.50 0.15 0.25 0.20\n"
        "0 0.50 0.50 0.90 1.00\n"
    )
    assert "  2: \"safety-vest\"" in (output / "data.yaml").read_text(encoding="utf-8")
    assert "  16: \"safety-vest\"" in (sh17_output / "data.yaml").read_text(encoding="utf-8")

    manifest = json.loads((output / "manifest.json").read_text(encoding="utf-8"))
    assert manifest["counts"]["images"] == 3
    assert manifest["counts"]["dropped_labels"] == {"head": 3}
    assert manifest["deduplication"]["cross_split_duplicate_groups"] == 1
    assert manifest["deduplication"]["removed_images"] == 1
    assert manifest["deduplication"]["removed_by_split"]["train"]["images"] == 1
    assert (source / "labels" / "train" / "duplicate-test.txt").read_text(
        encoding="utf-8"
    ) == SOURCE_LABEL
    sh17_manifest = json.loads(
        (sh17_output / "manifest.json").read_text(encoding="utf-8")
    )
    assert sh17_manifest["dropped_classes"] == []
    assert sh17_manifest["counts"]["output_labels_by_class"]["head"] == 3


@pytest.mark.parametrize(
    ("bad_row", "message"),
    [
        ("0 0.95 0.5 0.2 0.2\n", "extends outside"),
        ("4 0.5 0.5 0.2 0.2\n", "class ID 4"),
        ("0 0.5 0.5 0.2\n", "five YOLO fields"),
    ],
)
def test_prepare_rejects_invalid_yolo_rows_without_output(tmp_path, bad_row, message):
    source = make_source(tmp_path)
    (source / "labels" / "train" / "train.txt").write_text(bad_row, encoding="utf-8")
    output = tmp_path / "canonical"

    with pytest.raises(DatasetPreparationError, match=message):
        prepare_dataset(
            source,
            output,
            source_url="https://example.test/dataset.zip",
            source_license="CC BY 4.0",
        )

    assert not output.exists()


def test_copy_fallback_archive_hash_and_safe_output_replacement(tmp_path, monkeypatch):
    source = make_source(tmp_path)
    archive = tmp_path / "source.zip"
    archive.write_bytes(b"archive")
    output = tmp_path / "canonical"
    monkeypatch.setattr(os, "link", lambda *_args: (_ for _ in ()).throw(OSError("no links")))

    prepare_dataset(
        source,
        output,
        source_url="https://example.test/dataset.zip",
        source_license="CC BY 4.0",
        source_archive_path=archive,
    )
    manifest = json.loads((output / "manifest.json").read_text(encoding="utf-8"))
    assert manifest["image_transfer"] == {"copied": 3, "hardlinked": 0}
    assert manifest["source"]["archive"]["sha256"] == hashlib.sha256(b"archive").hexdigest()

    with pytest.raises(DatasetPreparationError, match="Refusing nonempty output"):
        prepare_dataset(
            source,
            output,
            source_url="https://example.test/dataset.zip",
            source_license="CC BY 4.0",
        )

    prepare_dataset(
        source,
        output,
        source_url="https://example.test/dataset.zip",
        source_license="CC BY 4.0",
        replace_generated=True,
    )
    unknown_output = tmp_path / "unknown"
    unknown_output.mkdir()
    (unknown_output / "keep.txt").write_text("do not delete", encoding="utf-8")
    with pytest.raises(DatasetPreparationError, match="unrecognized output"):
        prepare_dataset(
            source,
            unknown_output,
            source_url="https://example.test/dataset.zip",
            source_license="CC BY 4.0",
            replace_generated=True,
        )
    assert (unknown_output / "keep.txt").read_text(encoding="utf-8") == "do not delete"


def test_conflicting_duplicate_labels_are_quarantined_from_all_splits(tmp_path):
    source = make_source(tmp_path)
    add_sample(source, "train", "conflict.jpg", b"conflict", "0 0.5 0.5 0.2 0.2\n")
    add_sample(source, "val", "conflict.jpg", b"conflict", "2 0.5 0.5 0.2 0.2\n")
    output = tmp_path / "canonical"
    reports = prepare_dataset(source, output, source_url="https://example.test/data", source_license="CC0")
    assert not (output / "images/train/conflict.jpg").exists()
    assert not (output / "images/val/conflict.jpg").exists()
    assert (source / "images/train/conflict.jpg").exists()
    assert reports["canonical"]["deduplication"]["conflicting_group_count"] == 1
    assert reports["canonical"]["counts"]["images"] == 3
