import json

from PIL import Image
import pytest
import yaml

from scripts.score_ppe_predictions import box_iou, match_counts, score_predictions


def test_iou_and_confidence_ordered_matching_count_duplicates_and_misses():
    assert box_iou([0, 0, 10, 10], [0, 0, 10, 10]) == 1
    assert box_iou([0, 0, 0, 0], [0, 0, 0, 0]) == 0
    truth = [[0, 0, 10, 10], [20, 20, 30, 30]]
    predictions = [{"bbox": [0, 0, 10, 10], "score": 0.8},
                   {"bbox": [0, 0, 10, 10], "score": 0.9},
                   {"bbox": [20, 20, 10, 10], "score": 0.19}]
    assert match_counts(truth, predictions, 0.20, 0.50) == {"tp": 1, "fp": 1, "fn": 1}
    assert match_counts([], predictions, 0.20, 0.50) == {"tp": 0, "fp": 2, "fn": 0}


def test_confidence_boundary_and_iou_boundary_are_inclusive():
    prediction = {"bbox": [0, 0, 5, 10], "score": 0.20}
    assert match_counts([[0, 0, 10, 10]], [prediction], 0.20, 0.50) == {"tp": 1, "fp": 0, "fn": 0}


def test_scorer_uses_category_offset_file_name_and_held_out_labels(tmp_path):
    root = tmp_path / "dataset"
    (root / "images/test").mkdir(parents=True)
    (root / "labels/test").mkdir(parents=True)
    Image.new("RGB", (100, 100)).save(root / "images/test/001.png")
    (root / "labels/test/001.txt").write_text("10 0.5 0.5 0.2 0.2\n16 0.5 0.5 0.4 0.4\n")
    data = root / "data.yaml"
    data.write_text(yaml.safe_dump({"path": root.as_posix(), "names": {10: "helmet", 16: "safety-vest"}}))
    predictions = tmp_path / "predictions.json"
    predictions.write_text(json.dumps([
        {"file_name": "001.png", "image_id": 1, "category_id": 11, "bbox": [40, 40, 20, 20], "score": 0.9},
        {"file_name": "001.png", "image_id": 1, "category_id": 17, "bbox": [30, 30, 40, 40], "score": 0.1}]))
    result = score_predictions(predictions, data)
    assert result["per_class"]["helmet"]["tp"] == 1
    assert result["per_class"]["helmet"]["recall"] == 1
    assert result["per_class"]["safety-vest"]["fn"] == 1
    assert result["per_class"]["safety-vest"]["precision"] is None
    bad_slice = tmp_path / "bad-list.txt"
    bad_slice.write_text((root / "images/train/example.jpg").as_posix())
    with pytest.raises(ValueError, match="test split"):
        score_predictions(predictions, data, image_list=bad_slice)
