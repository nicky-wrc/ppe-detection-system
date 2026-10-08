import asyncio
import base64
import json
import io
import time
from unittest.mock import AsyncMock, Mock

import httpx
import cv2
import numpy as np
import pytest
from fastapi import UploadFile
from pydantic import SecretStr

from app.core.config import settings
from app.services.cloud_evidence import CloudEvidenceError, CloudEvidenceStore, jwt_claims
from app.services.detection_service import DetectionService


def frame_file():
    success, encoded = cv2.imencode('.jpg', np.zeros((32, 32, 3), dtype=np.uint8))
    assert success
    return UploadFile(filename='frame.jpg', file=io.BytesIO(encoded.tobytes()))


def make_service(monkeypatch, detect):
    service = object.__new__(DetectionService)
    service.detector = Mock(detect=detect, engine_metadata={"device": "cpu", "crop_refinement": False})
    monkeypatch.setattr(service, '_get_detection_options', lambda *_: ([], .2, .3))
    monkeypatch.setattr(service, '_settings_summary', lambda *_: {})
    return service


def token(claims):
    payload = base64.urlsafe_b64encode(json.dumps(claims).encode()).decode().rstrip('=')
    return f'header.{payload}.test-signature'


@pytest.fixture
def storage_config(monkeypatch):
    monkeypatch.setattr(settings, 'CLOUD_STORAGE_URL', 'https://testproject.supabase.co')
    monkeypatch.setattr(settings, 'CLOUD_STORAGE_BUCKET', 'ppe-demo-evidence')
    monkeypatch.setattr(settings, 'CLOUD_STORAGE_PUBLIC_KEY', SecretStr('sb_publishable_test'))
    monkeypatch.setattr(settings, 'CLOUD_STORAGE_EMAIL', 'storage@example.com')
    monkeypatch.setattr(settings, 'CLOUD_STORAGE_PASSWORD', SecretStr('private-test-password'))


def test_private_storage_round_trip_and_cached_identity(storage_config):
    requests = []
    identity = token({'sub': '1a2ba15d-a73e-4651-a422-f373ec371252',
                      'role': 'authenticated', 'exp': time.time() + 3600})

    def handler(request):
        requests.append(request)
        if request.url.path == '/auth/v1/token':
            assert request.url.params['grant_type'] == 'password'
            return httpx.Response(200, json={'access_token': identity})
        assert request.headers['authorization'] == f'Bearer {identity}'
        assert request.headers['apikey'] == 'sb_publishable_test'
        if request.method == 'POST':
            assert request.headers['x-upsert'] == 'false'
            assert request.content == b'\xff\xd8test-jpeg'
            return httpx.Response(200, json={'Key': 'ignored'})
        assert '/object/authenticated/ppe-demo-evidence/' in request.url.path
        return httpx.Response(200, content=b'\xff\xd8test-jpeg')

    async def check():
        store = CloudEvidenceStore(httpx.MockTransport(handler))
        reference = await store.upload(b'\xff\xd8test-jpeg')
        assert reference.startswith('supabase://ppe-demo-evidence/')
        assert await store.download(reference) == b'\xff\xd8test-jpeg'
        assert len(requests) == 3
    asyncio.run(check())


@pytest.mark.parametrize('reference', [
    'https://evil.example/image.jpg', 'supabase://other-bucket/' + 'a' * 32 + '.jpg',
    'supabase://ppe-demo-evidence/../private.jpg',
    'supabase://ppe-demo-evidence/' + 'a' * 32 + '.jpg?token=secret',
])
def test_storage_rejects_untrusted_references(storage_config, reference):
    with pytest.raises(CloudEvidenceError):
        CloudEvidenceStore().object_key(reference)


def test_storage_rejects_privileged_keys(storage_config, monkeypatch):
    monkeypatch.setattr(settings, 'CLOUD_STORAGE_PUBLIC_KEY', SecretStr(token({'role': 'service_role'})))
    with pytest.raises(CloudEvidenceError, match='privileged'):
        CloudEvidenceStore()


@pytest.mark.parametrize('claims', [[], None, 'bad'])
def test_invalid_identity_claims_fail_closed(claims):
    with pytest.raises(CloudEvidenceError):
        jwt_claims(token(claims))


def test_failed_authentication_never_echoes_credentials(storage_config):
    store = CloudEvidenceStore(httpx.MockTransport(
        lambda _: httpx.Response(401, text='private-test-password sensitive-provider-error')))
    with pytest.raises(CloudEvidenceError) as error:
        asyncio.run(store.upload(b'\xff\xd8test'))
    assert str(error.value) == 'Private Storage authentication failed'


@pytest.mark.parametrize('consent,people,allowed,recent,expected', [
    (False, 1, True, False, 0), (True, 0, True, False, 0),
    (True, 1, False, False, 0), (True, 1, True, True, 0),
    (True, 1, True, False, 1),
])
def test_browser_recording_obeys_consent_settings_and_cooldown(monkeypatch, consent, people, allowed, recent, expected):
    import app.services.detection_service as module
    monkeypatch.setattr(settings, 'ENVIRONMENT', 'research_demo')
    monkeypatch.setattr(settings, 'CLOUD_BROWSER_RECORDING', True)
    monkeypatch.setattr(module, 'get_detection_cooldown', lambda *_: 60)
    service = make_service(monkeypatch, lambda *_args, **_kwargs: {'person_count': people})
    service.db = Mock()
    service.db.query.return_value.filter.return_value.first.return_value = object() if recent else None
    monkeypatch.setattr(service, '_allows_detection_record', lambda *_: allowed)
    persist = AsyncMock()
    monkeypatch.setattr(service, '_persist_cloud_frame', persist)
    asyncio.run(service.process_frame(frame_file(), user_id=1, recording_consent=consent))
    assert persist.await_count == expected


def test_cloud_frame_requires_explicit_consent(client, admin_headers, monkeypatch):
    monkeypatch.setattr(settings, 'ENVIRONMENT', 'research_demo')
    monkeypatch.setattr(settings, 'CLOUD_BROWSER_RECORDING', True)
    response = client.post('/api/v1/detection/frame', headers=admin_headers,
        files={'file': ('frame.jpg', b'fake', 'image/jpeg')})
    assert response.status_code == 409


def test_evidence_off_records_metadata_without_upload(monkeypatch):
    import app.services.detection_service as module
    import app.services.cloud_evidence as storage
    service = object.__new__(DetectionService)
    service.db = Mock()
    monkeypatch.setattr(module, 'resolve_detection_preferences', lambda *_: ([], .2, .3, False))
    get_store = Mock()
    monkeypatch.setattr(storage, 'get_cloud_evidence_store', get_store)
    response = dict(zone_id=None, detected_objects=[], persons=[], violations=[], person_count=1,
        violation_count=0, has_violation=False, processing_time_ms=10, summary={})
    asyncio.run(service._persist_cloud_frame(None, {}, response, 1))
    get_store.assert_not_called()
    saved = service.db.add.call_args.args[0]
    assert saved.original_image_path == 'cloud-browser-frame'
    assert saved.result_image_path is None
    service.db.commit.assert_called_once()


def test_cloud_snapshot_is_blurred_and_survives_new_db_session(monkeypatch, tmp_path):
    from sqlalchemy import create_engine
    from sqlalchemy.orm import Session
    from app.core.database import Base
    from app.models import Detection
    import app.services.detection_service as module
    import app.services.cloud_evidence as storage

    engine = create_engine(f'sqlite:///{(tmp_path / "isolated.db").as_posix()}')
    Base.metadata.create_all(engine)
    image = np.random.default_rng(5).integers(0, 255, (64, 64, 3), dtype=np.uint8)
    original = image.copy()
    persons = [{'bbox': [0, 0, 64, 64]}]
    store = Mock(upload=AsyncMock(return_value='supabase://ppe-demo-evidence/' + 'a' * 32 + '.jpg'))
    monkeypatch.setattr(storage, 'get_cloud_evidence_store', lambda: store)
    monkeypatch.setattr(module, 'resolve_detection_preferences', lambda *_: ([], .2, .3, True))
    response = dict(zone_id=None, detected_objects=[], persons=persons, violations=[], person_count=1,
        violation_count=0, has_violation=False, processing_time_ms=10, summary={})
    try:
        with Session(engine) as db:
            service = object.__new__(DetectionService)
            service.db = db
            def draw(blurred, result):
                assert not np.array_equal(blurred[:17], image[:17])
                assert np.array_equal(blurred[18:], image[18:])
                return blurred
            service.detector = Mock(draw_detections=draw)
            asyncio.run(service._persist_cloud_frame(image, {'persons': persons}, response, None))
            assert response['id'] > 0
        with Session(engine) as db:
            row = db.get(Detection, response['id'])
            assert row.original_image_path == 'cloud-browser-frame'
            assert row.result_image_path.startswith('supabase://ppe-demo-evidence/')
            assert row.person_count == 1
        assert store.upload.await_args.args[0].startswith(b'\xff\xd8')
        assert np.array_equal(image, original)
    finally:
        engine.dispose()
