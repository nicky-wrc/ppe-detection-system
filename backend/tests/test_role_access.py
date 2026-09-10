from datetime import date, datetime

from app.api.v1.endpoints import cameras as cameras_endpoint
from app.core.database import SessionLocal
from app.core.security import create_access_token, get_password_hash
from app.models import Alert, Camera, Detection, User, UserSettings, ViolationLog


def auth_headers_for_user(user_id: int) -> dict[str, str]:
    token = create_access_token({"sub": str(user_id)})
    return {"Authorization": f"Bearer {token}"}


def create_user(db, *, email: str, role: str) -> User:
    user = User(
        email=email,
        full_name=email.split("@", 1)[0].replace(".", " ").title(),
        hashed_password=get_password_hash("role-access-password"),
        role=role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def test_viewer_reads_all_shared_data_and_evidence_but_cannot_mutate(client, tmp_path):
    db = SessionLocal()
    viewer = None
    detection = None
    event = None
    alert = None
    camera = None
    try:
        owner = db.query(User).filter(User.email == "admin@example.com").one()
        viewer = create_user(db, email="global.viewer@example.com", role="viewer")
        headers = auth_headers_for_user(viewer.id)

        result_image = tmp_path / "shared-result.jpg"
        result_video = tmp_path / "shared-result.mp4"
        event_snapshot = tmp_path / "shared-event.jpg"
        event_clip = tmp_path / "shared-event.mp4"
        result_image.write_bytes(b"shared-result-image")
        result_video.write_bytes(b"shared-result-video")
        event_snapshot.write_bytes(b"shared-event-snapshot")
        event_clip.write_bytes(b"shared-event-clip")

        camera = Camera(
            name="Shared role test camera",
            owner_id=owner.id,
            source_type="usb",
            device_index=31,
            is_active=False,
            config={},
        )
        db.add(camera)
        db.flush()
        detection = Detection(
            user_id=owner.id,
            original_image_path="shared-source.jpg",
            result_image_path=str(result_image),
            result_video_path=str(result_video),
            violations=["no_helmet"],
            person_count=2,
            violation_count=1,
            has_violation=True,
            created_at=datetime.now(),
        )
        db.add(detection)
        db.flush()
        event = ViolationLog(
            user_id=owner.id,
            camera_id=camera.id,
            detection_id=detection.id,
            violation_type="no_helmet",
            confidence_score=92,
            person_count=1,
            snapshot_path=str(event_snapshot),
            evidence_clip_path=str(event_clip),
            status="new",
        )
        db.add(event)
        db.flush()
        alert = Alert(
            detection_id=detection.id,
            violation_log_id=event.id,
            alert_type="no_helmet",
            message="Shared alert",
            status="new",
        )
        db.add(alert)
        db.commit()
        db.refresh(detection)
        db.refresh(event)
        db.refresh(alert)

        history = client.get("/api/v1/detection/history?per_page=100", headers=headers)
        assert history.status_code == 200, history.text
        assert any(item["id"] == detection.id for item in history.json()["items"])

        stats = client.get("/api/v1/detection/stats", headers=headers)
        assert stats.status_code == 200, stats.text
        assert stats.json()["total_detections"] >= 1
        assert stats.json()["violation_by_type"]["no_helmet"] >= 1

        today = date.today().isoformat()
        analytics = client.get(
            f"/api/v1/detection/analytics/daily?start_date={today}&end_date={today}",
            headers=headers,
        )
        assert analytics.status_code == 200, analytics.text
        assert analytics.json()["daily"][0]["detections"] >= 1

        detail = client.get(f"/api/v1/detection/{detection.id}", headers=headers)
        assert detail.status_code == 200
        assert detail.json()["id"] == detection.id
        image = client.get(f"/api/v1/detection/{detection.id}/image/result", headers=headers)
        assert image.status_code == 200
        assert image.content == b"shared-result-image"
        video = client.get(f"/api/v1/detection/{detection.id}/video/result", headers=headers)
        assert video.status_code == 200
        assert video.content == b"shared-result-video"

        alerts = client.get("/api/v1/alerts/?per_page=100", headers=headers)
        assert alerts.status_code == 200
        assert any(item["id"] == alert.id for item in alerts.json()["items"])
        events = client.get("/api/v1/events/?per_page=100", headers=headers)
        assert events.status_code == 200
        assert any(item["id"] == event.id for item in events.json()["items"])
        event_detail = client.get(f"/api/v1/events/{event.id}", headers=headers)
        assert event_detail.status_code == 200
        assert event_detail.json()["id"] == event.id
        snapshot = client.get(f"/api/v1/events/{event.id}/evidence/snapshot", headers=headers)
        assert snapshot.status_code == 200
        assert snapshot.content == b"shared-event-snapshot"
        clip = client.get(f"/api/v1/events/{event.id}/evidence/clip", headers=headers)
        assert clip.status_code == 200
        assert clip.content == b"shared-event-clip"

        cameras = client.get("/api/v1/cameras/", headers=headers)
        assert cameras.status_code == 200
        assert any(item["id"] == camera.id for item in cameras.json())
        assert client.get(f"/api/v1/cameras/{camera.id}", headers=headers).status_code == 200
        assert client.get(f"/api/v1/cameras/{camera.id}/preview", headers=headers).status_code == 403

        assert client.put(f"/api/v1/alerts/{alert.id}/acknowledge", headers=headers).status_code == 403
        assert client.put(f"/api/v1/events/{event.id}/acknowledge", headers=headers).status_code == 403
        assert client.put(
            f"/api/v1/events/{event.id}/resolve",
            headers=headers,
            json={"notes": "Viewer must not resolve"},
        ).status_code == 403
        assert client.put(
            "/api/v1/settings/me",
            headers=headers,
            json={"alert_sound": False},
        ).status_code == 403

        image_upload = {"file": ("sample.jpg", b"not-an-image", "image/jpeg")}
        video_upload = {"file": ("sample.mp4", b"not-a-video", "video/mp4")}
        assert client.post("/api/v1/detection/image", headers=headers, files=image_upload).status_code == 403
        assert client.post("/api/v1/detection/frame", headers=headers, files=image_upload).status_code == 403
        assert client.post("/api/v1/detection/video", headers=headers, files=video_upload).status_code == 403
        assert client.post(f"/api/v1/cameras/{camera.id}/test", headers=headers).status_code == 403
        assert client.post(f"/api/v1/cameras/{camera.id}/start", headers=headers).status_code == 403
        assert client.post(f"/api/v1/cameras/{camera.id}/stop", headers=headers).status_code == 403
        assert client.put(
            f"/api/v1/cameras/{camera.id}",
            headers=headers,
            json={"name": "Viewer edit attempt"},
        ).status_code == 403
        assert client.delete(f"/api/v1/cameras/{camera.id}", headers=headers).status_code == 403
    finally:
        if alert is not None and alert.id is not None:
            db.query(Alert).filter(Alert.id == alert.id).delete()
        if event is not None and event.id is not None:
            db.query(ViolationLog).filter(ViolationLog.id == event.id).delete()
        if detection is not None and detection.id is not None:
            db.query(Detection).filter(Detection.id == detection.id).delete()
        if camera is not None and camera.id is not None:
            db.query(Camera).filter(Camera.id == camera.id).delete()
        if viewer is not None and viewer.id is not None:
            db.query(UserSettings).filter(UserSettings.user_id == viewer.id).delete()
            db.query(User).filter(User.id == viewer.id).delete()
        db.commit()
        db.close()


def test_safety_officer_has_operational_access_without_admin_configuration_access(
    client,
    monkeypatch,
):
    db = SessionLocal()
    safety = None
    detection = None
    alert = None
    event = None
    camera = None
    try:
        owner = db.query(User).filter(User.email == "admin@example.com").one()
        safety = create_user(db, email="role.safety@example.com", role="safety_officer")
        headers = auth_headers_for_user(safety.id)
        camera = Camera(
            name="Safety operations camera",
            owner_id=owner.id,
            source_type="usb",
            device_index=30,
            is_active=False,
            config={},
        )
        db.add(camera)
        db.flush()
        detection = Detection(
            user_id=owner.id,
            original_image_path="safety-shared-source.jpg",
            violations=["no_vest"],
            person_count=1,
            violation_count=1,
            has_violation=True,
        )
        db.add(detection)
        db.flush()
        event = ViolationLog(
            user_id=owner.id,
            camera_id=camera.id,
            detection_id=detection.id,
            violation_type="no_vest",
            confidence_score=88,
            person_count=1,
            status="new",
        )
        db.add(event)
        db.flush()
        alert = Alert(
            detection_id=detection.id,
            violation_log_id=event.id,
            alert_type="no_vest",
            status="new",
        )
        db.add(alert)
        db.commit()
        db.refresh(camera)
        db.refresh(detection)
        db.refresh(event)
        db.refresh(alert)

        acknowledged = client.put(f"/api/v1/events/{event.id}/acknowledge", headers=headers)
        assert acknowledged.status_code == 200, acknowledged.text
        assert acknowledged.json()["status"] == "acknowledged"
        resolved = client.put(
            f"/api/v1/alerts/{alert.id}/resolve",
            headers=headers,
            json={"resolution_note": "Safety review completed"},
        )
        assert resolved.status_code == 200, resolved.text
        assert resolved.json()["status"] == "resolved"

        settings = client.put(
            "/api/v1/settings/me",
            headers=headers,
            json={"alert_sound": False, "confidence_threshold": 40},
        )
        assert settings.status_code == 200, settings.text
        assert settings.json()["alert_sound"] is False
        assert settings.json()["confidence_threshold"] == 40

        async def fake_start(_camera_id: int) -> None:
            return None

        async def fake_stop(_camera_id: int) -> None:
            return None

        monkeypatch.setattr(cameras_endpoint, "test_camera_source", lambda _camera: {"ok": True})
        monkeypatch.setattr(cameras_endpoint.camera_runtime, "start", fake_start)
        monkeypatch.setattr(cameras_endpoint.camera_runtime, "stop", fake_stop)
        monkeypatch.setattr(cameras_endpoint.camera_runtime, "get_preview", lambda _camera_id: None)

        assert client.get(f"/api/v1/cameras/{camera.id}/preview", headers=headers).status_code == 204
        tested = client.post(f"/api/v1/cameras/{camera.id}/test", headers=headers)
        assert tested.status_code == 200, tested.text
        assert tested.json()["ok"] is True
        assert client.post(f"/api/v1/cameras/{camera.id}/start", headers=headers).status_code == 200
        assert client.post(f"/api/v1/cameras/{camera.id}/stop", headers=headers).status_code == 200

        async def fake_process_image(_service, file, user_id, zone_id):
            assert user_id == safety.id
            return detection

        monkeypatch.setattr("app.services.detection_service.DetectionService.process_image", fake_process_image)
        upload = client.post(
            "/api/v1/detection/image",
            headers=headers,
            files={"file": ("sample.jpg", b"image", "image/jpeg")},
        )
        assert upload.status_code == 200, upload.text

        assert client.get("/api/v1/admin/users", headers=headers).status_code == 403
        assert client.get("/api/v1/cameras/devices", headers=headers).status_code == 403
        assert client.post(
            "/api/v1/cameras/",
            headers=headers,
            json={"name": "Safety create attempt", "source_type": "usb", "device_index": 29, "config": {}},
        ).status_code == 403
        assert client.put(
            f"/api/v1/cameras/{camera.id}",
            headers=headers,
            json={"name": "Safety edit attempt"},
        ).status_code == 403
        assert client.delete(f"/api/v1/cameras/{camera.id}", headers=headers).status_code == 403
    finally:
        if alert is not None and alert.id is not None:
            db.query(Alert).filter(Alert.id == alert.id).delete()
        if event is not None and event.id is not None:
            db.query(ViolationLog).filter(ViolationLog.id == event.id).delete()
        if detection is not None and detection.id is not None:
            db.query(Detection).filter(Detection.id == detection.id).delete()
        if camera is not None and camera.id is not None:
            db.query(Camera).filter(Camera.id == camera.id).delete()
        if safety is not None and safety.id is not None:
            db.query(UserSettings).filter(UserSettings.user_id == safety.id).delete()
            db.query(User).filter(User.id == safety.id).delete()
        db.commit()
        db.close()
