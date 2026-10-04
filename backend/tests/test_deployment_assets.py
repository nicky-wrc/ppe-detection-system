"""Guard the deployment source allowlists without starting Docker or real DBs."""
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]


def rules(name):
    return [line.strip() for line in (REPO / name / '.dockerignore').read_text().splitlines()
            if line.strip() and not line.startswith('#')]


def test_backend_context_is_source_only():
    items = rules('backend')
    assert items[0] == '**'
    assert {'!app/', '!app/**', '!alembic/', '!alembic/**', '!requirements.txt', '!alembic.ini'} <= set(items)
    assert not any(line.startswith('!') and any(word in line for word in
                   ('.env', '.venv', 'uploads', 'datasets', 'experiments', '*.pt')) for line in items)
    for exclusion in ('**/.env', '**/.env.*', '**/*.pt', '**/*.key'):
        assert items.index(exclusion) > items.index('!app/**')


def test_frontend_context_excludes_environment_files():
    items = rules('frontend')
    assert items[0] == '**'
    assert {'!package-lock.json', '!src/', '!src/**', '!public/**', '!vite.config.ts'} <= set(items)
    assert '**/.env' in items and '**/.env.*' in items
    assert not any(line.startswith('!') and '.env' in line for line in items)


def test_frontend_public_api_url_is_injected_before_build():
    dockerfile = (REPO / 'frontend' / 'Dockerfile').read_text()
    assert 'RUN npm ci' in dockerfile
    assert dockerfile.index('ARG VITE_API_URL') < dockerfile.index('RUN npm run build')
    assert 'ENV VITE_API_URL=${VITE_API_URL}' in dockerfile
    assert 'DATABASE_URL' not in dockerfile and 'SECRET_KEY' not in dockerfile
