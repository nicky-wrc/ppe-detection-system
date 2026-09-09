import asyncio
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


def test_paused_purge_never_opens_database_or_unlinks_files(monkeypatch, tmp_path):
    evidence = tmp_path / "existing.jpg"
    evidence.write_bytes(b"keep existing evidence")
    monkeypatch.setattr(retention_service.settings, "EVIDENCE_RETENTION_ENABLED", False)
    with patch.object(retention_service, "SessionLocal") as session, patch.object(
        retention_service, "_safe_unlink"
    ) as unlink:
        assert retention_service.purge_expired_evidence() == 0
    session.assert_not_called()
    unlink.assert_not_called()
    assert evidence.read_bytes() == b"keep existing evidence"


def test_paused_loop_returns_without_scheduling_cleanup(monkeypatch):
    monkeypatch.setattr(retention_service.settings, "EVIDENCE_RETENTION_ENABLED", False)
    with patch.object(retention_service.asyncio, "to_thread") as dispatch:
        asyncio.run(retention_service.retention_loop())
    dispatch.assert_not_called()


def test_enabled_purge_keeps_existing_database_workflow(monkeypatch):
    monkeypatch.setattr(retention_service.settings, "EVIDENCE_RETENTION_ENABLED", True)
    with patch.object(retention_service, "SessionLocal") as session:
        session.return_value.query.return_value.filter.return_value.all.return_value = []
        assert retention_service.purge_expired_evidence() == 0
    session.return_value.commit.assert_called_once()
    session.return_value.close.assert_called_once()
