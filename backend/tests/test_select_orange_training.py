from pathlib import Path

import cv2
import numpy as np
import pytest
import yaml

from scripts.select_orange_training import select_training


def _write_sample(root: Path, name: str, color: tuple[int, int, int], label: str) -> None:
    cv2.imwrite(str(root / f"images/train/{name}.png"), np.full((20, 20, 3), color, dtype=np.uint8))
    (root / f"labels/train/{name}.txt").write_text(label, encoding="utf-8")


def test_selection_retains_orange_vests_balances_helmets_and_keeps_splits(tmp_path):
    root = tmp_path / "source"
    (root / "images/train").mkdir(parents=True)
    (root / "labels/train").mkdir(parents=True)
    orange = (0, 128, 255)
    white = (255, 255, 255)
    _write_sample(root, "vest", orange, "16 0.5 0.5 1 1\n")
    _write_sample(root, "helmet_a", orange, "10 0.5 0.5 1 1\n")
    _write_sample(root, "helmet_b", orange, "10 0.5 0.5 1 1\n")
    _write_sample(root, "negative", white, "12 0.5 0.5 1 1\n")
    _write_sample(root, "not_orange", white, "16 0.5 0.5 1 1\n")
    config = {
        "path": root.as_posix(), "train": "images/train", "val": "images/val",
        "test": "images/test", "names": {10: "helmet", 16: "safety-vest"},
    }
    data = root / "data.yaml"
    data.write_text(yaml.safe_dump(config), encoding="utf-8")
    originals = {path: path.read_bytes() for path in root.rglob("*") if path.is_file()}

    output = tmp_path / "orange-training"
    report = select_training(data, output, target_images=3, negatives=1)
    selected = {Path(row).stem for row in (output / "train.txt").read_text().splitlines()}
    assert "vest" in selected
    assert "negative" in selected
    assert len(selected & {"helmet_a", "helmet_b"}) == 1
    assert report["selected_unique_images"] == 3
    generated = yaml.safe_load((output / "data.yaml").read_text())
    assert generated["val"] == "images/val"
    assert generated["test"] == "images/test"
    assert all(path.read_bytes() == contents for path, contents in originals.items())
    with pytest.raises(FileExistsError, match="frozen selection"):
        select_training(data, output, target_images=3, negatives=1)


def test_selection_rejects_invalid_targets(tmp_path):
    with pytest.raises(ValueError, match="target_images"):
        select_training(tmp_path / "missing.yaml", tmp_path / "out", target_images=5, negatives=5)


def test_materialized_view_uses_separate_cache_directories(tmp_path):
    root = tmp_path / "source"
    for split in ("train", "val", "test"):
        (root / f"images/{split}").mkdir(parents=True)
        (root / f"labels/{split}").mkdir(parents=True)
        cv2.imwrite(str(root / f"images/{split}/{split}.png"), np.full((20, 20, 3), (0, 128, 255), dtype=np.uint8))
        label = "16 0.5 0.5 1 1\n" if split == "train" else "10 0.5 0.5 1 1\n"
        (root / f"labels/{split}/{split}.txt").write_text(label, encoding="utf-8")
    cv2.imwrite(str(root / "images/train/negative.png"), np.full((20, 20, 3), 255, dtype=np.uint8))
    (root / "labels/train/negative.txt").write_text("12 0.5 0.5 1 1\n", encoding="utf-8")
    data = root / "data.yaml"
    data.write_text(yaml.safe_dump({
        "path": root.as_posix(), "train": "images/train", "val": "images/val",
        "test": "images/test", "names": {10: "helmet", 16: "safety-vest"},
    }), encoding="utf-8")
    output = tmp_path / "materialized"
    report = select_training(data, output, target_images=2, negatives=1, materialize=True)
    generated = yaml.safe_load((output / "data.yaml").read_text())
    assert Path(generated["path"]) == (output / "dataset").resolve()
    assert generated["train"] == "images/train"
    assert (output / "dataset/images/val/val.png").is_file()
    assert (output / "dataset/labels/test/test.txt").is_file()
    assert report["file_transfer"]["hardlinked"] + report["file_transfer"]["copied"] == 8
