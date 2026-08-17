import asyncio

from app.core.database import SessionLocal
from app.models import Alert, Detection, User
from app.services.detection_service import DetectionService
from app.services.websocket_manager import ws_manager


def test_detection_alerts_are_persisted_and_broadcast_to_owner(client, monkeypatch):
    db = SessionLocal()
    detection: Detection | None = None
    broadcasts: list[tuple[dict, int | None]] = []

    async def capture_broadcast(payload: dict, user_id: int | None = None) -> None:
        broadcasts.append((payload, user_id))

    monkeypatch.setattr(ws_manager, "broadcast_alert", capture_broadcast)

    try:
        owner = db.query(User).filter(User.email == "admin@example.com").one()
        detection = Detection(
            user_id=owner.id,
            original_image_path="test-confirmed-live-frame.jpg",
            violations=["no_helmet", "no_safety-vest"],
            person_count=1,
            violation_count=2,
            has_violation=True,
        )
        db.add(detection)
        db.commit()
        db.refresh(detection)

        service = object.__new__(DetectionService)
        service.db = db
        asyncio.run(service._create_alerts(detection))

        alerts = (
            db.query(Alert)
            .filter(Alert.detection_id == detection.id)
            .order_by(Alert.id)
            .all()
        )
        assert [alert.alert_type for alert in alerts] == ["no_helmet", "no_safety-vest"]
        assert [payload["violation_type"] for payload, _ in broadcasts] == [
            "no_helmet",
            "no_safety-vest",
        ]
        assert all(payload["detection_id"] == detection.id for payload, _ in broadcasts)
        assert all(payload["camera_name"] == "Detection" for payload, _ in broadcasts)
        assert all(user_id == owner.id for _, user_id in broadcasts)
    finally:
        if detection is not None and detection.id is not None:
            db.query(Alert).filter(Alert.detection_id == detection.id).delete()
            db.query(Detection).filter(Detection.id == detection.id).delete()
            db.commit()
        db.close()
