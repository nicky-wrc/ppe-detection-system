from unittest.mock import Mock

import pytest
from pydantic import ValidationError
from sqlalchemy import create_engine

from app.core.database_scope import configure_schema_engine, validate_schema_name, verify_isolated_role
from tests.test_research_demo import demo_settings


@pytest.mark.parametrize('schema', ['public', 'pg_catalog', 'auth', 'storage', 'extensions',
    'information_schema', 'ppe_demo,public', 'ppe_demo;DROP TABLE users', '', 'A', 'a' * 64])
def test_schema_rejects_public_system_or_injected_names(schema):
    with pytest.raises(ValueError):
        validate_schema_name(schema)


@pytest.mark.parametrize('overrides', [dict(DATABASE_SCHEMA=None), dict(DATABASE_ROLE=None),
    dict(DATABASE_SCHEMA='another_demo'), dict(DATABASE_ROLE='postgres'),
    dict(DATABASE_URL='postgresql://postgres.project:test@host/postgres?sslmode=require'),
    dict(DATABASE_URL='postgresql://ppe_demo_app.project:test@host/postgres'),
    dict(DATABASE_URL='sqlite:///demo.db')])
def test_demo_requires_dedicated_postgres_schema_role_and_tls(overrides):
    with pytest.raises((ValidationError, ValueError)):
        demo_settings(**overrides)


def test_sqlite_scope_cannot_silently_fall_back():
    engine = create_engine('sqlite://')
    with pytest.raises(ValueError, match='PostgreSQL'):
        configure_schema_engine(engine, 'ppe_demo', 'ppe_demo_app')
    configure_schema_engine(engine, None, None)
    engine.dispose()


@pytest.mark.parametrize('identity', [('postgres', 'postgres', 'ppe_demo'),
    ('ppe_demo_app', 'ppe_demo_app', 'public'), ('ppe_demo_app', 'ppe_demo_app', None),
    ('ppe_demo_app', 'postgres', 'ppe_demo')])
def test_role_check_rejects_admin_missing_schema_or_set_role(identity):
    cursor = Mock()
    cursor.fetchone.return_value = identity
    with pytest.raises(ValueError, match='dedicated'):
        verify_isolated_role(cursor, 'ppe_demo', 'ppe_demo_app')
    assert cursor.execute.call_count == 1


@pytest.mark.parametrize('permissions', [(True, False, True), (False, True, True),
    (False, False, False), None])
def test_role_check_rejects_privileged_inherited_or_wrong_owner(permissions):
    cursor = Mock()
    cursor.fetchone.side_effect = [('ppe_demo_app', 'ppe_demo_app', 'ppe_demo'), permissions]
    with pytest.raises(ValueError, match='dedicated'):
        verify_isolated_role(cursor, 'ppe_demo', 'ppe_demo_app')


def test_role_check_rejects_grants_to_old_data_or_data_api():
    cursor = Mock()
    cursor.fetchone.side_effect = [('ppe_demo_app', 'ppe_demo_app', 'ppe_demo'), (False, False, True), (True,)]
    with pytest.raises(ValueError, match='isolation failed'):
        verify_isolated_role(cursor, 'ppe_demo', 'ppe_demo_app')


def test_valid_role_checks_explicit_permissions_not_search_path_only():
    cursor = Mock()
    cursor.fetchone.side_effect = [('ppe_demo_app', 'ppe_demo_app', 'ppe_demo'), (False, False, True), (False,)]
    verify_isolated_role(cursor, 'ppe_demo', 'ppe_demo_app')
    assert cursor.execute.call_count == 3
    assert cursor.execute.call_args.args[1] == ('ppe_demo', 'ppe_demo_app', 'ppe_demo_app', 'ppe_demo', 'ppe_demo_app', 'ppe_demo', 'ppe_demo_app')
