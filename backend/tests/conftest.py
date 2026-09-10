import os
import tempfile
from pathlib import Path

import pytest
from fastapi.testclient import TestClient


TEST_DB = Path(tempfile.gettempdir()) / "ppe_detection_api_tests.db"
TEST_DB.unlink(missing_ok=True)
os.environ["ENVIRONMENT"] = "test"
os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB.as_posix()}"
os.environ["AUTO_CREATE_TABLES"] = "true"
os.environ["SECRET_KEY"] = "test-secret-key-with-at-least-32-characters"
os.environ["BOOTSTRAP_ADMIN_EMAIL"] = "admin@example.com"
os.environ["BOOTSTRAP_ADMIN_PASSWORD"] = "secure-admin-password"
os.environ["ALLOW_PUBLIC_REGISTRATION"] = "true"
# Keep API expectations independent of an operator's local model/retention trial.
os.environ["MODEL_PATH"] = "./yolo8m.pt"
os.environ["PERSON_MODEL_PATH"] = "./yolo11n.pt"
os.environ["MODEL_VERSION"] = "sh17-yolov8m-yolo11n-hybrid-v1"
os.environ["EVIDENCE_RETENTION_ENABLED"] = "true"

from app.main import app  # noqa: E402
from app.core.database import engine  # noqa: E402


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as test_client:
        yield test_client
    engine.dispose()
    TEST_DB.unlink(missing_ok=True)


def login(client: TestClient, email: str, password: str) -> dict[str, str]:
    response = client.post(
        "/api/v1/auth/login",
        data={"username": email, "password": password},
    )
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


@pytest.fixture(scope="session")
def admin_headers(client):
    return login(client, "admin@example.com", "secure-admin-password")
