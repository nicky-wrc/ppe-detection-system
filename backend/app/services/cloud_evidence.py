"""Private, bucket-scoped evidence access; credentials never leave the backend."""
import asyncio
import base64
import json
import re
import time
import uuid
from functools import lru_cache

import httpx

from app.core.config import settings


class CloudEvidenceError(RuntimeError):
    pass


def jwt_claims(token: str) -> dict:
    """Inspect privilege type only; Supabase still verifies signature and RLS."""
    try:
        payload = token.split('.')[1]
        claims = json.loads(base64.urlsafe_b64decode(payload + '=' * (-len(payload) % 4)))
        if not isinstance(claims, dict):
            raise ValueError('Invalid claims')
        return claims
    except (IndexError, ValueError, TypeError):
        raise CloudEvidenceError('Invalid Storage identity') from None


class CloudEvidenceStore:
    MAX_BYTES = 5 * 1024 * 1024

    def __init__(self, transport=None):
        if (not settings.CLOUD_STORAGE_URL or
            not re.fullmatch(r'https://[a-z0-9]+\.supabase\.co', settings.CLOUD_STORAGE_URL) or
            settings.CLOUD_STORAGE_BUCKET != 'ppe-demo-evidence' or
            not settings.CLOUD_STORAGE_PUBLIC_KEY or not settings.CLOUD_STORAGE_EMAIL or
            not settings.CLOUD_STORAGE_PASSWORD):
            raise CloudEvidenceError('Private Storage configuration is incomplete')
        self.origin = settings.CLOUD_STORAGE_URL
        self.bucket = settings.CLOUD_STORAGE_BUCKET
        self.public_key = settings.CLOUD_STORAGE_PUBLIC_KEY.get_secret_value()
        if not self.public_key.startswith('sb_publishable_') and jwt_claims(self.public_key).get('role') != 'anon':
            raise CloudEvidenceError('Use a publishable key, not a privileged Supabase key')
        self.email = settings.CLOUD_STORAGE_EMAIL
        self.password = settings.CLOUD_STORAGE_PASSWORD.get_secret_value()
        self.transport = transport
        self.token = ''
        self.expires_at = 0.0
        self.login_lock = asyncio.Lock()

    def client(self) -> httpx.AsyncClient:
        return httpx.AsyncClient(transport=self.transport, timeout=25, follow_redirects=False)

    async def headers(self) -> dict[str, str]:
        async with self.login_lock:
            if time.time() >= self.expires_at:
                async with self.client() as client:
                    response = await client.post(f'{self.origin}/auth/v1/token',
                        params={'grant_type': 'password'}, headers={'apikey': self.public_key},
                        json={'email': self.email, 'password': self.password})
                if response.status_code != 200:
                    raise CloudEvidenceError('Private Storage authentication failed')
                try:
                    token = response.json()['access_token']
                    claims = jwt_claims(token)
                    uuid.UUID(claims['sub'])
                    expiry = float(claims['exp'])
                    if claims.get('role') != 'authenticated' or expiry <= time.time() + 60:
                        raise ValueError('Invalid restricted session')
                except (KeyError, TypeError, ValueError, AttributeError):
                    raise CloudEvidenceError('Invalid restricted Storage session') from None
                self.token = token
                self.expires_at = expiry - 60
            return {'apikey': self.public_key, 'Authorization': f'Bearer {self.token}'}

    def object_key(self, reference: str) -> str:
        prefix = f'supabase://{self.bucket}/'
        if not reference.startswith(prefix):
            raise CloudEvidenceError('Invalid evidence reference')
        key = reference[len(prefix):]
        if not re.fullmatch(r'[a-f0-9]{32}\.jpg', key):
            raise CloudEvidenceError('Invalid evidence object')
        return key

    async def upload(self, content: bytes) -> str:
        if not content.startswith(b'\xff\xd8') or len(content) > self.MAX_BYTES:
            raise CloudEvidenceError('Invalid evidence image')
        key = f'{uuid.uuid4().hex}.jpg'
        headers = {**await self.headers(), 'Content-Type': 'image/jpeg', 'x-upsert': 'false'}
        async with self.client() as client:
            response = await client.post(f'{self.origin}/storage/v1/object/{self.bucket}/{key}',
                headers=headers, content=content)
        if response.status_code not in {200, 201}:
            raise CloudEvidenceError('Private evidence upload failed')
        return f'supabase://{self.bucket}/{key}'

    async def download(self, reference: str) -> bytes:
        key = self.object_key(reference)
        async with self.client() as client:
            async with client.stream('GET', f'{self.origin}/storage/v1/object/authenticated/{self.bucket}/{key}',
                headers=await self.headers()) as response:
                if response.status_code != 200:
                    raise CloudEvidenceError('Private evidence unavailable')
                content = bytearray()
                async for chunk in response.aiter_bytes():
                    content.extend(chunk)
                    if len(content) > self.MAX_BYTES:
                        raise CloudEvidenceError('Evidence exceeds size limit')
        if not content.startswith(b'\xff\xd8'):
            raise CloudEvidenceError('Invalid evidence content')
        return bytes(content)


@lru_cache
def get_cloud_evidence_store() -> CloudEvidenceStore:
    return CloudEvidenceStore()
