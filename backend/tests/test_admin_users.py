from app.core.security import create_access_token

from .conftest import login


def auth_headers_for_user(user_id: int) -> dict[str, str]:
    token = create_access_token({"sub": str(user_id)})
    return {"Authorization": f"Bearer {token}"}


def test_admin_can_create_user_with_role_and_new_user_can_login(client, admin_headers):
    payload = {
        "email": "managed.safety@example.com",
        "full_name": "Managed Safety Officer",
        "password": "managed-password-123",
        "role": "safety_officer",
    }

    response = client.post("/api/v1/admin/users", headers=admin_headers, json=payload)

    assert response.status_code == 201, response.text
    created = response.json()
    assert created["email"] == payload["email"]
    assert created["full_name"] == payload["full_name"]
    assert created["role"] == "safety_officer"
    assert created["is_active"] is True
    assert "password" not in created
    assert "hashed_password" not in created

    user_headers = login(client, payload["email"], payload["password"])
    profile = client.get("/api/v1/auth/me", headers=user_headers)
    assert profile.status_code == 200
    assert profile.json()["role"] == "safety_officer"

    users = client.get("/api/v1/admin/users", headers=admin_headers)
    assert users.status_code == 200
    assert any(user["id"] == created["id"] for user in users.json())


def test_admin_can_change_role_and_deactivate_user(client, admin_headers):
    payload = {
        "email": "managed.viewer@example.com",
        "full_name": "Managed Viewer",
        "password": "viewer-password-123",
        "role": "viewer",
    }
    created_response = client.post("/api/v1/admin/users", headers=admin_headers, json=payload)
    assert created_response.status_code == 201, created_response.text
    user_id = created_response.json()["id"]
    user_headers = auth_headers_for_user(user_id)

    role_response = client.patch(
        f"/api/v1/admin/users/{user_id}",
        headers=admin_headers,
        json={"role": "safety_officer"},
    )
    assert role_response.status_code == 200, role_response.text
    assert role_response.json()["role"] == "safety_officer"

    profile = client.get("/api/v1/auth/me", headers=user_headers)
    assert profile.status_code == 200
    assert profile.json()["role"] == "safety_officer"

    deactivate_response = client.patch(
        f"/api/v1/admin/users/{user_id}",
        headers=admin_headers,
        json={"is_active": False},
    )
    assert deactivate_response.status_code == 200, deactivate_response.text
    assert deactivate_response.json()["is_active"] is False
    assert client.get("/api/v1/auth/me", headers=user_headers).status_code == 401


def test_admin_user_create_rejects_duplicate_email_and_invalid_role(client, admin_headers):
    payload = {
        "email": "managed.duplicate@example.com",
        "full_name": "Managed Duplicate",
        "password": "duplicate-password-123",
        "role": "viewer",
    }
    first_response = client.post("/api/v1/admin/users", headers=admin_headers, json=payload)
    assert first_response.status_code == 201, first_response.text

    duplicate_response = client.post("/api/v1/admin/users", headers=admin_headers, json=payload)
    assert duplicate_response.status_code == 409
    assert duplicate_response.json()["detail"] == "Email already exists"

    invalid_role_response = client.post(
        "/api/v1/admin/users",
        headers=admin_headers,
        json={**payload, "email": "managed.invalid-role@example.com", "role": "owner"},
    )
    assert invalid_role_response.status_code == 400
    assert invalid_role_response.json()["detail"] == "Invalid role"


def test_viewer_cannot_manage_users(client, admin_headers):
    payload = {
        "email": "managed.restricted@example.com",
        "full_name": "Managed Restricted Viewer",
        "password": "restricted-password-123",
        "role": "viewer",
    }
    created_response = client.post("/api/v1/admin/users", headers=admin_headers, json=payload)
    assert created_response.status_code == 201, created_response.text
    user_id = created_response.json()["id"]
    viewer_headers = auth_headers_for_user(user_id)

    assert client.get("/api/v1/admin/users", headers=viewer_headers).status_code == 403
    assert client.post("/api/v1/admin/users", headers=viewer_headers, json=payload).status_code == 403
    assert client.patch(
        f"/api/v1/admin/users/{user_id}",
        headers=viewer_headers,
        json={"role": "admin"},
    ).status_code == 403
