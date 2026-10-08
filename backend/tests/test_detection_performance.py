import json
from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.api.v1.endpoints.detection import _browser_performance, _save_browser_performance
from app.core.database import Base
from app.models import Detection
from app.services.detection_service import DetectionService


METRICS = {
    "api_host": "localhost:8000", "elapsed_ms": 5000, "completed": 4,
    "failed": 1, "skipped": 2, "processing_ms": 200,
    "delay_ms": 450, "target_interval_ms": 1000,
}


@pytest.mark.parametrize("key,value", [
    ("elapsed_ms", 0), ("completed", 0), ("failed", -1),
    ("processing_ms", float("nan")), ("delay_ms", float("inf")),
    ("target_interval_ms", 0), ("api_host", "https://user:password@host"),
    ("accuracy", 99),
])
def test_invalid_metrics_are_rejected(key, value):
    with pytest.raises(HTTPException) as error:
        _browser_performance(json.dumps({**METRICS, key: value}))
    assert error.value.status_code == 422


def test_optional_metrics_and_size_limit():
    assert _browser_performance(None) is None
    with pytest.raises(HTTPException):
        _browser_performance(" " * 2049)


@pytest.mark.parametrize("endpoint", ["image", "frame", "frame/compliant-report"])
def test_api_rejects_invalid_metrics_before_processing(client, admin_headers, endpoint):
    response = client.post(
        f"/api/v1/detection/{endpoint}", headers=admin_headers,
        files={"file": ("frame.jpg", b"not-an-image", "image/jpeg")},
        data={"comparison_metrics": json.dumps({**METRICS, "completed": -1})},
    )
    assert response.status_code == 422
    assert response.json()["detail"] == "Invalid camera performance metrics"


def test_browser_metrics_survive_reload_without_overwriting_summary():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        detection = Detection(original_image_path="test.jpg", summary={"status": "compliant", "settings": {"ppe_check_enabled": True}})
        db.add(detection)
        db.commit()
        _save_browser_performance(db, detection, _browser_performance(json.dumps(METRICS)))
        detection_id = detection.id
        db.expunge_all()
        saved = db.get(Detection, detection_id)
        assert saved.summary["browser_performance"] == METRICS
        assert saved.summary["settings"] == {"ppe_check_enabled": True}
        assert saved.summary["status"] == "compliant"
    engine.dispose()


def test_runtime_identifies_actual_engine_without_claiming_accuracy():
    service = object.__new__(DetectionService)
    service.detector = SimpleNamespace(engine_metadata={"device": "cpu", "crop_refinement": False})
    summary = service._summary_with_settings({"summary": {"status": "no_person"}}, {"ppe_check_enabled": True})
    assert summary["runtime"]["device"] == "cpu"
    assert summary["runtime"]["crop_refinement"] is False
    assert summary["runtime"]["model_version"]
    assert "accuracy" not in summary
