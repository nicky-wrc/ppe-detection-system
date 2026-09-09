from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock

import pytest
import uvicorn

import run_local
from app.core.config import settings
from app.ml import detector


@pytest.fixture
def local_runtime(monkeypatch):
    monkeypatch.setattr(settings, "EVIDENCE_RETENTION_ENABLED", False)
    backend = Path(run_local.__file__).resolve().parent
    fake = SimpleNamespace(
        ppe_model_path=(backend / settings.MODEL_PATH).resolve(),
        person_model_path=(backend / settings.PERSON_MODEL_PATH).resolve(),
        engine_metadata={"ppe_model": "yolo8m.pt", "person_model": "yolo11n.pt", "device": "cuda:0"},
    )
    monkeypatch.setattr(detector, "get_detector", lambda: fake)
    monkeypatch.setattr(run_local.os, "chdir", Mock())
    run = Mock()
    monkeypatch.setattr(uvicorn, "run", run)
    return fake, run


def test_check_mode_does_not_start_api_or_camera_tasks(local_runtime):
    _, run = local_runtime
    run_local.main(["--check"])
    run.assert_not_called()


def test_local_launcher_uses_one_process_with_explicit_address(local_runtime):
    _, run = local_runtime
    run_local.main(["--host", "127.0.0.1", "--port", "8000"])
    run.assert_called_once_with("app.main:app", host="127.0.0.1", port=8000)


def test_launcher_refuses_unexpected_model_fallback(local_runtime):
    fake, run = local_runtime
    fake.ppe_model_path = Path("unexpected-fallback.pt")
    with pytest.raises(SystemExit, match="refusing to start with a fallback"):
        run_local.main([])
    run.assert_not_called()


def test_launcher_refuses_to_start_with_automatic_cleanup_enabled(local_runtime, monkeypatch):
    _, run = local_runtime
    monkeypatch.setattr(settings, "EVIDENCE_RETENTION_ENABLED", True)
    with pytest.raises(SystemExit, match="preserve existing evidence"):
        run_local.main([])
    run.assert_not_called()
