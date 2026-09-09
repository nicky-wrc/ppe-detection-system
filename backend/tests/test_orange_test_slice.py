from pathlib import Path

import cv2
import numpy as np
import pytest
import yaml

from scripts.select_orange_test_slice import orange_fraction, select_slice


def test_hsv_selection_distinguishes_saturated_orange_from_white_and_yellow():
    orange = np.full((20, 20, 3), (0, 128, 255), dtype=np.uint8)
    white = np.full((20, 20, 3), 255, dtype=np.uint8)
    yellow = np.full((20, 20, 3), (0, 255, 255), dtype=np.uint8)
    assert orange_fraction(orange, [0.5, 0.5, 1, 1]) == 1.0
    assert orange_fraction(white, [0.5, 0.5, 1, 1]) == 0.0
    assert orange_fraction(yellow, [0.5, 0.5, 1, 1]) == 0.0
    assert orange_fraction(orange, [0.5, 0.5, 0, 0]) == 0.0


def test_slice_selects_only_test_ppe_and_preserves_all_labels(tmp_path):
    root = tmp_path / "source"
    (root / "images/test").mkdir(parents=True)
    (root / "labels/test").mkdir(parents=True)
    label_text = "16 0.5 0.5 1 1\n12 0.5 0.5 0.1 0.1\n"
    for name, color, label in (("orange", (0, 128, 255), label_text),
                               ("white", (255, 255, 255), label_text),
                               ("head", (0, 128, 255), "12 0.5 0.5 1 1\n")):
        cv2.imwrite(str(root / f"images/test/{name}.png"), np.full((20, 20, 3), color, dtype=np.uint8))
        (root / f"labels/test/{name}.txt").write_text(label, encoding="utf-8")
    config = {"path": root.as_posix(), "train": "images/train", "val": "images/val",
              "test": "images/test", "names": {10: "helmet", 12: "head", 16: "safety-vest"}}
    data = root / "data.yaml"
    data.write_text(yaml.safe_dump(config), encoding="utf-8")
    originals = {path: path.read_bytes() for path in root.rglob("*") if path.is_file()}
    output = tmp_path / "slice"
    report = select_slice(data, output)
    assert report["images"] == 1
    assert report["orange_like_objects"] == {"helmet": 0, "safety-vest": 1}
    assert Path((output / "test.txt").read_text().strip()).name == "orange.png"
    assert all(path.read_bytes() == contents for path, contents in originals.items())
    assert yaml.safe_load((output / "data.yaml").read_text())["val"] == "images/val"
    with pytest.raises(FileExistsError, match="locked slice"):
        select_slice(data, output)
