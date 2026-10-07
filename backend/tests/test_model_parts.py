import hashlib
import json

import httpx
import pytest

import render_start
from scripts import split_model_artifact as splitter


def digest(data):
    return hashlib.sha256(data).hexdigest()


def mock_download(monkeypatch, contents):
    real_client = httpx.Client
    requests = []

    def respond(request):
        requests.append(request)
        value = contents[request.url.path]
        if isinstance(value, Exception):
            raise value
        if isinstance(value, int):
            return httpx.Response(value)
        return httpx.Response(200, content=value)

    def factory(**kwargs):
        assert kwargs['follow_redirects'] is False
        return real_client(transport=httpx.MockTransport(respond), **kwargs)

    monkeypatch.setattr(render_start.httpx, 'Client', factory)
    return requests


def test_split_and_download_preserve_source(tmp_path, monkeypatch):
    monkeypatch.setattr(splitter, 'PART_BYTES', 4)
    source = tmp_path / 'ppe.onnx'
    original = b'0123456789'
    source.write_bytes(original)
    output = tmp_path / 'parts'
    manifest = splitter.split_artifact(source, output, digest(original))
    assert [p['bytes'] for p in manifest['parts']] == [4, 4, 2]
    assert manifest['reassembled_sha256'] == digest(original)
    assert json.loads((output / 'parts-manifest.json').read_text()) == manifest
    contents = {'/' + p['file']: (output / p['file']).read_bytes() for p in manifest['parts']}
    urls = ['https://private.invalid' + path for path in contents]
    requests = mock_download(monkeypatch, contents)
    destination = tmp_path / 'download' / 'ppe.onnx'
    render_start.fetch_model(destination, urls, digest(original), 'test-token')
    assert destination.read_bytes() == original == source.read_bytes()
    assert not destination.with_suffix('.download').exists()
    assert all(r.headers['authorization'] == 'Bearer test-token' for r in requests)
    assert [r.url.path for r in requests] == list(contents)
    render_start.fetch_model(destination, urls, digest(original))
    assert len(requests) == 3  # Verified existing model needs no download.
    with pytest.raises(ValueError):
        splitter.split_artifact(source, output, digest(original))


@pytest.mark.parametrize('contents,urls', [
    ({'/a': b'abc', '/b': b'def'}, ['https://private.invalid/b', 'https://private.invalid/a']),
    ({'/a': b'abc', '/b': b'broken'}, ['https://private.invalid/a', 'https://private.invalid/b']),
    ({'/a': b'abc', '/b': 403}, ['https://private.invalid/a', 'https://private.invalid/b']),
    ({'/a': b'abc', '/b': 302}, ['https://private.invalid/a', 'https://private.invalid/b']),
    ({'/a': b'abc', '/b': b''}, ['https://private.invalid/a', 'https://private.invalid/b']),
    ({'/a': b'abc', '/b': httpx.ReadTimeout('test')}, ['https://private.invalid/a', 'https://private.invalid/b']),
])
def test_failed_parts_never_publish_model(tmp_path, monkeypatch, contents, urls):
    mock_download(monkeypatch, contents)
    destination = tmp_path / 'ppe.onnx'
    with pytest.raises((ValueError, httpx.ReadTimeout)):
        render_start.fetch_model(destination, urls, digest(b'abcdef'))
    assert not destination.exists()
    assert not destination.with_suffix('.download').exists()


@pytest.mark.parametrize('limit', ['MAX_PART_BYTES', 'MAX_MODEL_BYTES'])
def test_download_size_limits(tmp_path, monkeypatch, limit):
    monkeypatch.setattr(render_start, limit, 3)
    mock_download(monkeypatch, {'/a': b'abcd'})
    destination = tmp_path / 'ppe.onnx'
    with pytest.raises(ValueError):
        render_start.fetch_model(destination, ['https://private.invalid/a'], digest(b'abcd'))
    assert not destination.exists() and not destination.with_suffix('.download').exists()


def test_existing_and_incomplete_files_are_not_deleted(tmp_path):
    destination = tmp_path / 'ppe.onnx'
    destination.write_bytes(b'original')
    with pytest.raises(ValueError):
        render_start.fetch_model(destination, 'https://private.invalid/a', digest(b'new'))
    assert destination.read_bytes() == b'original'
    missing = tmp_path / 'person.onnx'
    incomplete = missing.with_suffix('.download')
    incomplete.write_bytes(b'preserve')
    with pytest.raises(ValueError):
        render_start.fetch_model(missing, 'https://private.invalid/a', digest(b'new'))
    assert incomplete.read_bytes() == b'preserve'


@pytest.mark.parametrize('raw', ['not-json', '{}', '[]', '[1]', '["a"]' * 9])
def test_invalid_parts_config(monkeypatch, raw):
    monkeypatch.setenv('PPE_MODEL_PART_URLS', raw)
    with pytest.raises(ValueError):
        render_start.model_download_urls('PPE')


def test_parts_config_precedence_and_single_url_compatibility(monkeypatch, tmp_path):
    urls = ['https://private.invalid/a', 'https://private.invalid/b']
    monkeypatch.setenv('PPE_MODEL_DOWNLOAD_URL', 'https://private.invalid/old')
    monkeypatch.setenv('PPE_MODEL_PART_URLS', json.dumps(urls))
    assert render_start.model_download_urls('PPE') == urls
    monkeypatch.delenv('PPE_MODEL_PART_URLS')
    assert render_start.model_download_urls('PPE') == 'https://private.invalid/old'
    mock_download(monkeypatch, {'/old': b'original'})
    destination = tmp_path / 'legacy.pt'
    render_start.fetch_model(destination, render_start.model_download_urls('PPE'), digest(b'original'))
    assert destination.read_bytes() == b'original'


@pytest.mark.parametrize('urls', [[], ['http://private.invalid/a'],
    ['https://user:pass@private.invalid/a'], ['https://private.invalid/a'] * 2])
def test_unsafe_urls_rejected(tmp_path, urls):
    with pytest.raises(ValueError):
        render_start.fetch_model(tmp_path / 'ppe.onnx', urls, digest(b'test'))


def test_wrong_source_hash_does_not_create_parts(tmp_path):
    source = tmp_path / 'ppe.onnx'
    source.write_bytes(b'original')
    output = tmp_path / 'parts'
    with pytest.raises(ValueError):
        splitter.split_artifact(source, output, digest(b'wrong'))
    assert source.read_bytes() == b'original' and not output.exists()
