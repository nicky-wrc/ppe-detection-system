from pathlib import Path
from unittest.mock import Mock

import pytest
from pydantic import ValidationError
from alembic.config import Config

from app.core.config import Settings, settings
from app.main import demo_frame_lock
from render_start import fetch_model


def demo_settings(**overrides):
    values = dict(ENVIRONMENT='research_demo', RESEARCH_DEMO_ACKNOWLEDGED=True,
        RESEARCH_DEMO_DATABASE_CONFIRMED=True, DEBUG=False, AUTO_CREATE_TABLES=False,
        DATABASE_SCHEMA='ppe_demo', DATABASE_ROLE='ppe_demo_app',
        DATABASE_URL='postgresql://ppe_demo_app.project:test-only@host/postgres?sslmode=require',
        ALLOW_PUBLIC_REGISTRATION=False, EVIDENCE_RETENTION_ENABLED=False,
        SECRET_KEY='unique-demo-secret-at-least-32-characters',
        ALLOWED_ORIGINS='https://demo.example.com', MODEL_LICENSE_APPROVED=False)
    values.update(overrides)
    return Settings(**values)


def test_research_demo_does_not_assert_production_license_approval():
    assert demo_settings().MODEL_LICENSE_APPROVED is False


@pytest.mark.parametrize('overrides', [dict(RESEARCH_DEMO_ACKNOWLEDGED=False),
    dict(RESEARCH_DEMO_DATABASE_CONFIRMED=False), dict(DEBUG=True),
    dict(ALLOW_PUBLIC_REGISTRATION=True), dict(AUTO_CREATE_TABLES=True),
    dict(EVIDENCE_RETENTION_ENABLED=True), dict(SECRET_KEY='short'),
    dict(ALLOWED_ORIGINS='http://example.com'), dict(ALLOWED_ORIGINS='https://*')])
def test_demo_refuses_unsafe_configuration(overrides):
    with pytest.raises(ValidationError):
        demo_settings(**overrides)


@pytest.mark.parametrize('method,path', [('get','/metrics'), ('get','/api/v1/cameras/devices'),
    ('post','/api/v1/cameras/1/start'), ('post','/api/v1/detection/image'),
    ('post','/api/v1/detection/video'), ('post','/api/v1/detection/frame/compliant-report'),
    ('post','/api/v1/auth/forgot-password/confirm')])
def test_demo_blocks_persistence_and_native_camera_access(client, monkeypatch, method, path):
    monkeypatch.setattr(settings, 'ENVIRONMENT', 'research_demo')
    assert getattr(client, method)(path).status_code == 403


def test_demo_frame_still_requires_authentication(client, monkeypatch):
    monkeypatch.setattr(settings, 'ENVIRONMENT', 'research_demo')
    response = client.post('/api/v1/detection/frame', files={'file': ('a.jpg', b'fake', 'image/jpeg')})
    assert response.status_code == 401


def test_demo_busy_does_not_queue_frames(client, monkeypatch):
    monkeypatch.setattr(settings, 'ENVIRONMENT', 'research_demo')
    monkeypatch.setattr(demo_frame_lock, 'locked', lambda: True)
    assert client.post('/api/v1/detection/frame').status_code == 429


def test_demo_rejects_oversized_frame_before_parsing(client, monkeypatch):
    monkeypatch.setattr(settings, 'ENVIRONMENT', 'research_demo')
    response = client.post('/api/v1/detection/frame', headers={'Content-Length': str(settings.MAX_FRAME_SIZE + 65537)})
    assert response.status_code == 413


def test_checkpoint_existing_hash_verified_without_network(tmp_path, monkeypatch):
    import hashlib
    import render_start
    path = tmp_path / 'model.pt'
    path.write_bytes(b'test-artifact')
    download = Mock()
    monkeypatch.setattr(render_start.httpx, 'Client', download)
    fetch_model(path, '', hashlib.sha256(b'test-artifact').hexdigest())
    download.assert_not_called()
    with pytest.raises(ValueError, match='refusing overwrite'):
        fetch_model(path, '', '0' * 64)
    assert path.read_bytes() == b'test-artifact'


def test_checkpoint_plain_http_is_rejected(tmp_path):
    with pytest.raises(ValueError, match='HTTPS'):
        fetch_model(tmp_path / 'a.pt', 'http://example.com/a.pt', '0' * 64)


@pytest.mark.parametrize('status,valid_hash', [(200, True), (200, False), (302, True), (403, True)])
def test_checkpoint_download_is_private_hash_verified_and_atomic(tmp_path, monkeypatch, status, valid_hash):
    import hashlib
    import httpx
    import render_start
    payload = b'approved-checkpoint'
    expected = hashlib.sha256(payload).hexdigest() if valid_hash else '0' * 64
    actual_client = httpx.Client
    def handler(request):
        assert request.headers['Authorization'] == 'Bearer private-token'
        assert request.headers['apikey'] == 'private-token'
        return httpx.Response(status, content=payload)
    monkeypatch.setattr(render_start.httpx, 'Client', lambda **kwargs:
        actual_client(transport=httpx.MockTransport(handler), **kwargs))
    path = tmp_path / 'runtime_models' / 'ppe.pt'
    if status == 200 and valid_hash:
        fetch_model(path, 'https://storage.example.com/private/ppe.pt', expected, 'private-token')
        assert path.read_bytes() == payload
    else:
        with pytest.raises(ValueError):
            fetch_model(path, 'https://storage.example.com/private/ppe.pt', expected, 'private-token')
        assert not path.exists()
    assert not path.with_suffix('.download').exists()


def test_alembic_percent_encoded_password_round_trips():
    config = Config()
    url = 'postgresql://user:p%40ss@host/db?sslmode=require'
    config.set_main_option('sqlalchemy.url', url.replace('%', '%%'))
    assert config.get_main_option('sqlalchemy.url') == url


def test_timezone_data_available():
    from zoneinfo import ZoneInfo
    assert ZoneInfo('Asia/Bangkok').key == 'Asia/Bangkok'


def test_blueprint_has_no_paid_plan_or_secret_values():
    import yaml
    blueprint = yaml.safe_load((Path(__file__).resolve().parents[2] / 'render.yaml').read_text())
    backend, frontend = blueprint['services']
    assert backend['plan'] == 'free' and frontend['runtime'] == 'static'
    assert 'databases' not in blueprint
    for key in ('DATABASE_URL', 'BOOTSTRAP_ADMIN_PASSWORD', 'PPE_MODEL_DOWNLOAD_URL', 'MODEL_DOWNLOAD_TOKEN'):
        variable = next(item for item in backend['envVars'] if item['key'] == key)
        assert variable == {'key': key, 'sync': False}
