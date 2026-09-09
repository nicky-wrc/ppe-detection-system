from types import SimpleNamespace

import pytest
import yaml

from app.ml import evaluate_ppe


def test_class_id_mismatch_is_rejected_before_evaluation(tmp_path, monkeypatch):
    data = tmp_path / "data.yaml"
    data.write_text(yaml.safe_dump({"names": {0: "person", 1: "safety-vest", 2: "helmet"}}))
    monkeypatch.setattr(evaluate_ppe, "parse_args", lambda: SimpleNamespace(
        model=str(tmp_path / "model.pt"), data=str(data)))

    class Model:
        names = {0: "person", 1: "helmet", 2: "safety-vest"}

        def val(self, **kwargs):
            pytest.fail("Mismatched class IDs must never reach evaluation")

    monkeypatch.setattr(evaluate_ppe, "YOLO", lambda path: Model())
    with pytest.raises(SystemExit, match="class IDs/names differ"):
        evaluate_ppe.main()


def test_class_names_normalize_yaml_string_keys_and_lists():
    expected = {0: "person", 1: "helmet", 2: "safety-vest"}
    assert evaluate_ppe.normalize_class_names({str(key): value for key, value in expected.items()}) == expected
    assert evaluate_ppe.normalize_class_names(list(expected.values())) == expected
