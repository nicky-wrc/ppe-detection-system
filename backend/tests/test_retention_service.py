from unittest.mock import patch

from app.services import retention_service
from app.services.retention_service import _safe_unlink


def test_safe_unlink_ignores_non_file_references_without_warning():
    with patch.object(retention_service.logger, "warning") as warning:
        assert _safe_unlink("expired") is False
        assert _safe_unlink("camera:3") is False
        assert _safe_unlink("live-camera-frame") is False

    warning.assert_not_called()


def test_safe_unlink_only_removes_file_under_allowed_root(tmp_path):
    allowed = tmp_path / "evidence"
    allowed.mkdir()
    evidence = allowed / "event.jpg"
    evidence.write_bytes(b"evidence")
    outside = tmp_path / "outside.jpg"
    outside.write_bytes(b"keep")

    assert _safe_unlink(str(evidence), allowed) is True
    assert evidence.exists() is False

    with patch.object(retention_service.logger, "warning") as warning:
        assert _safe_unlink(str(outside), allowed) is False
    assert outside.exists() is True
    warning.assert_called_once()
