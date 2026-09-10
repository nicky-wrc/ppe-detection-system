import hashlib
from pathlib import Path

import pytest
import yaml

from scripts.select_ppe_training import select_training


def prepared_dataset(root: Path) -> Path:
    for split in ("train", "val", "test"):
        (root / "images" / split).mkdir(parents=True)
        (root / "labels" / split).mkdir(parents=True)
        for name, class_id in (("vest-a", 16), ("vest-b", 16), ("helmet-a", 10),
                               ("helmet-b", 10), ("helmet-c", 10), ("head", 12),
                               ("background", None)):
            (root / "images" / split / f"{name}.jpg").write_bytes(b"test image")
            label = "" if class_id is None else f"{class_id} 0.5 0.5 0.2 0.2\n"
            (root / "labels" / split / f"{name}.txt").write_text(label, encoding="utf-8")
    config = {"path": root.as_posix(), "train": "images/train", "val": "images/val",
              "test": "images/test", "names": {0: "person", 10: "helmet", 12: "head", 16: "safety-vest"}}
    data = root / "data.yaml"
    data.write_text(yaml.safe_dump(config), encoding="utf-8")
    return data


def test_selection_balances_ppe_without_changing_sources_or_held_out_splits(tmp_path):
    data = prepared_dataset(tmp_path)
    originals = {path: path.read_bytes() for path in tmp_path.rglob("*") if path.is_file()}
    report = select_training(data, seed=42, negatives=1)
    paths = [Path(line) for line in (tmp_path / "focused-train.txt").read_text().splitlines()]
    assert len(paths) == len(set(paths)) == 5
    assert all(path.parent == tmp_path / "images/train" for path in paths)
    assert {"vest-a", "vest-b"} <= {path.stem for path in paths}
    assert sum(path.stem.startswith("helmet") for path in paths) == 2
    assert sum(path.stem in {"head", "background"} for path in paths) == 1
    config = yaml.safe_load((tmp_path / "data-focused.yaml").read_text())
    assert config["val"] == "images/val"
    assert config["test"] == "images/test"
    assert all(path.read_bytes() == contents for path, contents in originals.items())
    assert report["selected_images"] == 5
    assert report["list_sha256"] == hashlib.sha256((tmp_path / "focused-train.txt").read_bytes()).hexdigest()


def test_selection_is_repeatable_for_the_same_seed(tmp_path):
    selections = []
    for name in ("first", "second"):
        root = tmp_path / name
        select_training(prepared_dataset(root), seed=17, negatives=1)
        selections.append([Path(line).name for line in (root / "focused-train.txt").read_text().splitlines()])
    assert selections[0] == selections[1]


def test_existing_selection_is_preserved(tmp_path):
    data = prepared_dataset(tmp_path)
    select_training(data)
    artifacts = {path: path.read_bytes() for path in tmp_path.glob("*focused*")}
    with pytest.raises(FileExistsError, match="Selection already exists"):
        select_training(data, seed=99)
    assert all(path.read_bytes() == contents for path, contents in artifacts.items())


def test_selection_rejects_missing_label_before_writing_outputs(tmp_path):
    data = prepared_dataset(tmp_path)
    (tmp_path / "images/train/unlabeled.jpg").write_bytes(b"unlabeled")
    with pytest.raises(ValueError, match="Missing label"):
        select_training(data)
    assert not (tmp_path / "focused-train.txt").exists()


def test_selection_rejects_wrong_class_mapping(tmp_path):
    data = prepared_dataset(tmp_path)
    config = yaml.safe_load(data.read_text())
    config["names"] = {0: "person", 1: "helmet", 2: "safety-vest"}
    data.write_text(yaml.safe_dump(config), encoding="utf-8")
    with pytest.raises(ValueError, match="SH17 class schema"):
        select_training(data)
    assert not (tmp_path / "focused-train.txt").exists()
