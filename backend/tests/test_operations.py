from alembic import command
from alembic.config import Config
from pathlib import Path
import pytest
from pydantic import ValidationError

from app.core.config import Settings


BACKEND_DIR = Path(__file__).resolve().parents[1]


def test_health_exposes_shared_read_policy(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["data_access_policy"] == "organization-shared-read-v1"


def test_alembic_upgrade_is_idempotent(client):
    config = Config(str(BACKEND_DIR / "alembic.ini"))
    config.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    command.upgrade(config, "head")
    command.upgrade(config, "head")


def test_active_model_metadata_requires_auth(client, admin_headers):
    assert client.get("/api/v1/models/active").status_code == 401
    response = client.get("/api/v1/models/active", headers=admin_headers)
    assert response.status_code == 200
    assert response.json()["classes"] == ["person", "helmet", "safety-vest"]
    assert response.json()["strategy"] == "yolov8-sh17-ppe+yolo11-person-assist"
    assert response.json()["models"]["ppe"]["filename"] == "yolo8m.pt"
    assert response.json()["models"]["person"]["filename"] == "yolo11n.pt"
    assert response.json()["license_approved"] is False
    assert response.json()["temporal"] == {"window_size": 5, "confirm_count": 4, "clear_count": 3}


def test_production_rejects_unapproved_model_license():
    with pytest.raises(ValidationError, match="MODEL_LICENSE_APPROVED"):
        Settings(
            ENVIRONMENT="production",
            SECRET_KEY="production-secret-with-more-than-32-characters",
            AUTO_CREATE_TABLES=False,
            MODEL_LICENSE_APPROVED=False,
        )
