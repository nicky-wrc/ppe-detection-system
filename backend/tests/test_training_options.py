from pathlib import Path

import pytest

from app.ml.train_ppe import parse_args, training_options


def test_project_resolves_to_requested_directory_and_low_memory_options(tmp_path):
    args = parse_args(["--data", "data.yaml", "--name", "trial", "--project", str(tmp_path),
                       "--workers", "0", "--freeze", "10", "--epochs", "2"])
    options = training_options(args)
    assert Path(options["project"]) == tmp_path.resolve()
    assert options["workers"] == 0
    assert options["cache"] is False
    assert options["freeze"] == 10
    assert options["close_mosaic"] == 2
    assert options["hsv_s"] == 0.7
    assert options["hsv_v"] == 0.4


def test_color_augmentation_can_be_reduced_for_orange_fine_tuning(tmp_path):
    args = parse_args([
        "--data", "data.yaml", "--name", "orange", "--project", str(tmp_path),
        "--hsv-h", "0.01", "--hsv-s", "0.35", "--hsv-v", "0.25",
    ])
    options = training_options(args)
    assert options["hsv_h"] == 0.01
    assert options["hsv_s"] == 0.35
    assert options["hsv_v"] == 0.25


def test_run_name_cannot_escape_project():
    args = parse_args(["--data", "data.yaml", "--name", "../existing"])
    with pytest.raises(ValueError, match="single directory"):
        training_options(args)
