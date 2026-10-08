"""Strict CPU research-demo entry point; secrets and model URLs are never logged."""
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
from urllib.parse import urlsplit

import httpx

EXPECTED_PPE_HASH = '833fa3362afad19f27ff68ac44a52e598d26bd96f7f9f750b5469bd2382e0b9c'
EXPECTED_PERSON_HASH = '0ebbc80d4a7680d14987a577cd21342b65ecfd94632bd9a8da63ae6417644ee1'
EXPECTED_ONNX_PPE_HASH = '5c7ab0aab104a90b0531edcd4146f573f4d5cc90ea42d352da895e5f5ad65228'
EXPECTED_ONNX_PERSON_HASH = 'f68462ab9ebaeb7aab8716ebab31e66269439bd9ff123f424ed3f2420ddf8faa'


MAX_MODEL_BYTES = 100 * 1024 * 1024
MAX_PART_BYTES = 40 * 1024 * 1024
DOWNLOAD_CHUNK_BYTES = 64 * 1024


def model_download_urls(prefix: str) -> str | list[str]:
    """Ordered private part URLs are operator secrets, never logged."""
    raw = os.environ.get(prefix + '_MODEL_PART_URLS', '')
    if not raw.strip():
        return os.environ.get(prefix + '_MODEL_DOWNLOAD_URL', '')
    if len(raw) > 65536:
        raise ValueError('Model part URL configuration is too large')
    try:
        urls = json.loads(raw)
    except json.JSONDecodeError:
        raise ValueError('Model part URLs must be an ordered JSON array') from None
    if not isinstance(urls, list) or not 1 <= len(urls) <= 8 or any(not isinstance(url, str) for url in urls):
        raise ValueError('Model part URLs require one to eight URL strings')
    return urls


def fetch_model(destination: Path, url: str | list[str], expected_hash: str, token: str = '') -> None:
    """Fetch an operator-approved HTTPS artifact, bounded and hash-verified."""
    if not re.fullmatch(r'[0-9a-f]{64}', expected_hash):
        raise ValueError('Invalid checkpoint SHA-256')
    if destination.exists():
        with destination.open('rb') as stream:
            if hashlib.file_digest(stream, 'sha256').hexdigest() == expected_hash:
                return
        raise ValueError('Existing checkpoint hash differs; refusing overwrite')
    multipart = isinstance(url, list)
    urls = url if multipart else [url]
    if not 1 <= len(urls) <= 8 or len(set(urls)) != len(urls):
        raise ValueError('Invalid or duplicate model part URLs')
    for part_url in urls:
        parsed = urlsplit(part_url)
        if parsed.scheme != 'https' or not parsed.hostname or parsed.username or parsed.password:
            raise ValueError('Provide private HTTPS checkpoint URLs without embedded login credentials')
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = destination.with_suffix('.download')
    if temporary.exists():
        raise ValueError('Incomplete download exists; inspect before retrying')
    headers = {'Authorization': 'Bearer ' + token, 'apikey': token} if token else {}
    hasher = hashlib.sha256()
    size = 0
    created = False
    try:
        with httpx.Client(timeout=120, follow_redirects=False) as client:
            with temporary.open('xb') as stream:
                created = True
                for part_url in urls:
                    part_size = 0
                    with client.stream('GET', part_url, headers=headers) as response:
                        if response.status_code != 200:
                            raise ValueError('Checkpoint download failed; check private storage permissions')
                        for chunk in response.iter_bytes(chunk_size=DOWNLOAD_CHUNK_BYTES):
                            part_size += len(chunk)
                            size += len(chunk)
                            if size > MAX_MODEL_BYTES or (multipart and part_size > MAX_PART_BYTES):
                                raise ValueError('Checkpoint download exceeds allowed size')
                            hasher.update(chunk)
                            stream.write(chunk)
                    if part_size == 0:
                        raise ValueError('Empty checkpoint part')
        if hasher.hexdigest() != expected_hash:
            raise ValueError('Downloaded checkpoint hash mismatch')
        temporary.rename(destination)
    finally:
        # Only our incomplete artifact, never an existing model or user media.
        if created:
            temporary.unlink(missing_ok=True)


def main() -> None:
    root = Path(__file__).resolve().parent
    os.chdir(root)
    from app.core.config import settings
    if settings.ENVIRONMENT != 'research_demo':
        raise ValueError('This entry point requires the explicitly acknowledged research_demo mode')
    if settings.INFERENCE_DEVICE != 'cpu':
        raise ValueError('Render Free deployment requires explicit CPU inference')
    from app.core.database import engine
    with engine.connect() as connection:
        # Verify credentials/schema isolation before downloads or migrations.
        connection.exec_driver_sql('SELECT 1')
    port = int(os.environ.get('PORT', '10000'))
    if not 1 <= port <= 65535:
        raise ValueError('Invalid service port')
    onnx_trial = settings.INFERENCE_BACKEND == 'onnx'
    for configured, default_hash, prefix in (
        (settings.MODEL_PATH, EXPECTED_ONNX_PPE_HASH if onnx_trial else EXPECTED_PPE_HASH, 'PPE'),
        (settings.PERSON_MODEL_PATH, EXPECTED_ONNX_PERSON_HASH if onnx_trial else EXPECTED_PERSON_HASH, 'PERSON'),
    ):
        path = (root / configured).resolve()
        if not path.is_relative_to(root / 'runtime_models'):
            raise ValueError('Cloud checkpoints must be under runtime_models')
        fetch_model(path, model_download_urls(prefix), default_hash,
                    os.environ.get('MODEL_DOWNLOAD_TOKEN', ''))
    # Migration only targets the verified dedicated role/schema, never public.
    result = subprocess.run([sys.executable, '-m', 'alembic', 'upgrade', 'head'], capture_output=True)
    if result.returncode:
        raise ValueError('Demo database migration failed; inspect configuration without exposing credentials')
    if not onnx_trial:
        import torch
        torch.set_num_threads(1)
    from app.ml.detector import get_detector
    detector = get_detector()
    if detector.ppe_model_path != (root / settings.MODEL_PATH).resolve() or detector.person_model_path != (root / settings.PERSON_MODEL_PATH).resolve():
        raise ValueError('Checkpoint fallback detected; refusing startup')
    import uvicorn
    uvicorn.run('app.main:app', host='0.0.0.0', port=port, workers=1, reload=False)


if __name__ == '__main__':
    try:
        main()
    except Exception as exc:
        # Never print exception details from URLs, DB connections or model loaders.
        print('Research demo startup failed:', type(exc).__name__, file=sys.stderr)
        raise SystemExit(1)
