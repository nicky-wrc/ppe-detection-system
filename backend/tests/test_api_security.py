from app.core.database import SessionLocal
from app.core.security import get_password_hash
from app.models import User
from app.services.camera_runtime import camera_runtime

from .conftest import login


def test_registration_cannot_self_assign_admin(client):
    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": "viewer@example.com",
            "full_name": "Factory Viewer",
            "password": "viewer-password",
            "role": "admin",
        },
    )
    assert response.status_code == 200
    assert response.json()["role"] == "viewer"


def test_viewer_cannot_create_camera(client):
    headers = login(client, "viewer@example.com", "viewer-password")
    response = client.post(
        "/api/v1/cameras/",
        headers=headers,
        json={"name": "USB Camera", "source_type": "usb", "device_index": 0, "config": {}},
    )
    assert response.status_code == 403


def test_admin_can_create_and_list_camera(client, admin_headers):
    response = client.post(
        "/api/v1/cameras/",
        headers=admin_headers,
        json={"name": "Line A Camera", "source_type": "usb", "device_index": 0, "config": {}},
    )
    assert response.status_code == 201, response.text
    assert response.json()["name"] == "Line A Camera"

    response = client.get("/api/v1/cameras/", headers=admin_headers)
    assert response.status_code == 200
    assert any(camera["name"] == "Line A Camera" for camera in response.json())


def test_camera_preview_requires_operational_role(client, admin_headers, monkeypatch):
    create_response = client.post(
        "/api/v1/cameras/",
        headers=admin_headers,
        json={"name": "Preview Camera", "source_type": "usb", "device_index": 1, "config": {}},
    )
    assert create_response.status_code == 201
    camera_id = create_response.json()["id"]

    db = SessionLocal()
    try:
        db.add(
            User(
                email="preview-viewer@example.com",
                full_name="Preview Viewer",
                hashed_password=get_password_hash("preview-viewer-password"),
                role="viewer",
            )
        )
        db.commit()
    finally:
        db.close()
    viewer_headers = login(client, "preview-viewer@example.com", "preview-viewer-password")

    assert client.get(f"/api/v1/cameras/{camera_id}/preview").status_code == 401
    assert client.get(
        f"/api/v1/cameras/{camera_id}/preview",
        headers=viewer_headers,
    ).status_code == 403
    assert client.get(f"/api/v1/cameras/{camera_id}/preview", headers=admin_headers).status_code == 204

    jpeg = b"\xff\xd8\xff\xd9"
    monkeypatch.setattr(camera_runtime, "get_preview", lambda _: (jpeg, 123.0))
    response = client.get(f"/api/v1/cameras/{camera_id}/preview", headers=admin_headers)
    assert response.status_code == 200
    assert response.content == jpeg
    assert response.headers["content-type"] == "image/jpeg"
    assert response.headers["cache-control"].startswith("no-store")


def test_inactive_user_token_is_rejected(client):
    db = SessionLocal()
    try:
        user = User(
            email="inactive@example.com",
            full_name="Inactive User",
            hashed_password=get_password_hash("inactive-password"),
            role="viewer",
            is_active=True,
        )
        db.add(user)
        db.commit()
    finally:
        db.close()
    headers = login(client, "inactive@example.com", "inactive-password")
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == "inactive@example.com").first()
        user.is_active = False
        db.commit()
    finally:
        db.close()
    assert client.get("/api/v1/auth/me", headers=headers).status_code == 401
