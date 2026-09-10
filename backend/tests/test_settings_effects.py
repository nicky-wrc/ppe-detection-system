from types import SimpleNamespace

import numpy as np
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.core.database import Base
from app.ml.detector import PPEDetector
from app.models import User, UserSettings, Zone
from app.services.camera_runtime import CameraRuntimeManager
from app.services.detection_preferences import resolve_detection_preferences
from app.services.detection_service import DetectionService
from app.services.evidence_recorder import EvidenceRecorder


@pytest.fixture
def preferences_db():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        db.add(User(id=1, email="preferences@example.com", hashed_password="unused", full_name="Preferences Test"))
        db.add(UserSettings(
            user_id=1, confidence_threshold=40, ppe_detection_sensitivity=80,
            active_ppe_rules={"helmet": False, "safety-vest": True}, save_evidence=False,
        ))
        db.commit()
        yield db
    engine.dispose()


def test_camera_and_upload_use_same_saved_detection_preferences(preferences_db):
    camera = SimpleNamespace(owner_id=1, zone_id=None)
    options = CameraRuntimeManager._detection_options(preferences_db, camera)
    assert options == (["safety-vest"], 0.17, 0.4, False)
    service = object.__new__(DetectionService)
    service.db = preferences_db
    assert service._get_detection_options(1, None) == options[:3]


def test_active_zone_overrides_personal_rules_including_empty_list(preferences_db):
    zone = Zone(name="Settings test", required_ppe=["helmet"], is_active=True)
    preferences_db.add(zone)
    preferences_db.commit()
    assert resolve_detection_preferences(preferences_db, 1, zone.id)[0] == ["helmet"]
    zone.required_ppe = []
    preferences_db.commit()
    assert resolve_detection_preferences(preferences_db, 1, zone.id)[0] == []
    zone.is_active = False
    preferences_db.commit()
    assert resolve_detection_preferences(preferences_db, 1, zone.id)[0] == ["safety-vest"]


def test_personal_rules_can_both_be_disabled(preferences_db):
    row = preferences_db.query(UserSettings).one()
    row.active_ppe_rules = {"helmet": False, "safety-vest": False}
    preferences_db.commit()
    assert CameraRuntimeManager._detection_options(
        preferences_db, SimpleNamespace(owner_id=1, zone_id=None),
    )[0] == []


def test_camera_reads_owner_preferences_not_other_account(preferences_db):
    preferences_db.add(User(id=2, email="operator@example.com", hashed_password="unused", full_name="Operator Test"))
    preferences_db.add(UserSettings(
        user_id=2, confidence_threshold=70, ppe_detection_sensitivity=20,
        active_ppe_rules={"helmet": True, "safety-vest": False}, save_evidence=True,
    ))
    preferences_db.commit()
    assert CameraRuntimeManager._detection_options(
        preferences_db, SimpleNamespace(owner_id=1, zone_id=None),
    ) == (["safety-vest"], 0.17, 0.4, False)


def test_running_session_observes_preferences_saved_in_another_session(preferences_db):
    # Keep the original ORM row alive, reproducing a long-lived camera session.
    cached = preferences_db.query(UserSettings).one()
    with Session(preferences_db.get_bind()) as writer:
        row = writer.query(UserSettings).one()
        row.active_ppe_rules = {"helmet": True, "safety-vest": False}
        row.confidence_threshold = 65
        row.ppe_detection_sensitivity = 100
        row.save_evidence = True
        writer.commit()
    assert cached.confidence_threshold == 40
    assert resolve_detection_preferences(preferences_db, 1, None) == (["helmet"], 0.1, 0.65, True)


def test_detector_respects_disabled_rules_without_loading_models(monkeypatch):
    detector = object.__new__(PPEDetector)
    detector.ppe_model = object()
    detector.ppe_model_path = None
    detector.person_model_path = None
    detector.device = "cpu"
    detector.crop_refinement_enabled = False
    monkeypatch.setattr(detector, "_predict", lambda *args: [])
    monkeypatch.setattr(detector, "_person_assist", lambda *args: [
        {"bbox": [10, 10, 90, 190], "confidence": 0.9},
    ])
    monkeypatch.setattr(detector, "_refine_ppe_in_person_crops", lambda *args: [])
    image = np.zeros((200, 100, 3), dtype=np.uint8)
    enabled = detector.detect(image, required_ppe=None)
    disabled = detector.detect(image, required_ppe=[])
    assert enabled["has_violation"] is True
    assert disabled["person_count"] == 1
    assert disabled["has_violation"] is False
    assert disabled["violation_count"] == 0


def test_disabling_evidence_discards_pending_memory_not_saved_files(tmp_path):
    existing = tmp_path / "existing.jpg"
    existing.write_bytes(b"previous evidence")
    recorder = EvidenceRecorder(tmp_path, camera_id=1, fps=1, pre_seconds=2, post_seconds=2)
    frame = np.zeros((40, 40, 3), dtype=np.uint8)
    recorder.push(frame)
    recorder.start_event(1)
    recorder.reset()
    assert not recorder.buffer
    assert not recorder.active
    assert recorder.push(frame) == []
    assert existing.read_bytes() == b"previous evidence"


def test_settings_api_saves_all_controls_and_reloads(client, admin_headers):
    endpoint = "/api/v1/settings/me"
    original = client.get(endpoint, headers=admin_headers).json()
    changes = {
        "alert_sound": False, "save_evidence": False, "confidence_threshold": 55,
        "ppe_detection_sensitivity": 100,
        "active_ppe_rules": {"helmet": False, "safety-vest": False},
    }
    try:
        response = client.put(endpoint, headers=admin_headers, json=changes)
        assert response.status_code == 200
        reloaded = client.get(endpoint, headers=admin_headers).json()
        for field, value in changes.items():
            assert reloaded[field] == value
    finally:
        restored = client.put(endpoint, headers=admin_headers, json={key: original[key] for key in changes})
        assert restored.status_code == 200
