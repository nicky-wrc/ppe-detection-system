"""Explicit integration check on a NEW local disposable PostgreSQL database only.

Not auto-collected by pytest. Run after starting an isolated local test cluster:
python tests/postgres_schema_check.py --port 55439
Retains its database for review; never drops data or uses backend/.env credentials.
"""
import argparse
import os
from pathlib import Path
import subprocess
import sys

import psycopg2
from psycopg2 import sql
from sqlalchemy import create_engine, text
from sqlalchemy.engine import URL

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))
from app.core.database_scope import configure_schema_engine
from scripts.prepare_demo_schema import provision_schema


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, required=True)
    args = parser.parse_args()
    if args.port == 5432:
        raise ValueError('Refusing the ordinary local database port')
    database = 'ppe_schema_check_20261006'
    admin = psycopg2.connect(host='127.0.0.1', port=args.port, user='postgres', dbname='postgres')
    admin.autocommit = True
    with admin.cursor() as cursor:
        cursor.execute(sql.SQL('CREATE DATABASE {}').format(sql.Identifier(database)))
        cursor.execute('CREATE ROLE schema_operator LOGIN CREATEROLE NOSUPERUSER')
        cursor.execute(sql.SQL('ALTER DATABASE {} OWNER TO schema_operator').format(sql.Identifier(database)))
        cursor.execute('CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN')
    admin.close()
    extension_admin = psycopg2.connect(host='127.0.0.1', port=args.port, user='postgres', dbname=database)
    with extension_admin:
        with extension_admin.cursor() as cursor:
            cursor.execute('CREATE SCHEMA extensions')
            cursor.execute('CREATE EXTENSION pg_stat_statements WITH SCHEMA extensions')
    extension_admin.close()
    connection = psycopg2.connect(host='127.0.0.1', port=args.port, user='schema_operator', dbname=database)
    with connection:
        with connection.cursor() as cursor:
            cursor.execute("CREATE TABLE public.users (id integer PRIMARY KEY, note text)")
            cursor.execute("INSERT INTO public.users VALUES (1, 'original data stays here')")
            cursor.execute("CREATE TABLE public.alembic_version (version_num varchar(32) PRIMARY KEY)")
            cursor.execute("INSERT INTO public.alembic_version VALUES ('old-public-revision')")
            cursor.execute('CREATE VIEW public.pg_stat_statements AS SELECT * FROM public.users')
            cursor.execute('GRANT SELECT ON public.pg_stat_statements TO PUBLIC')
    password = 'synthetic-test@percent%value!'
    try:
        provision_schema(connection, password)
        raise AssertionError('A spoofed extension view must not bypass isolation')
    except ValueError:
        connection.rollback()
    with connection:
        with connection.cursor() as cursor:
            cursor.execute("SELECT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='ppe_demo_app'), EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='ppe_demo')")
            assert cursor.fetchone() == (False, False)
            cursor.execute('REVOKE SELECT ON public.pg_stat_statements FROM PUBLIC')
    provision_schema(connection, password)
    with connection.cursor() as cursor:
        cursor.execute("SELECT a.admin_option, a.inherit_option, a.set_option FROM pg_auth_members a JOIN pg_roles r ON r.oid=a.roleid JOIN pg_roles m ON m.oid=a.member WHERE r.rolname='ppe_demo_app' AND m.rolname='schema_operator'")
        assert cursor.fetchone() == (True, False, False)
    connection.rollback()
    try:
        provision_schema(connection, password)
        raise AssertionError('Must refuse existing demo objects')
    except ValueError:
        connection.rollback()
    demo_url = URL.create('postgresql+psycopg2', username='ppe_demo_app', password=password,
        host='127.0.0.1', port=args.port, database=database)
    environment = dict(os.environ, ENVIRONMENT='test', DATABASE_URL=demo_url.render_as_string(hide_password=False),
        DATABASE_SCHEMA='ppe_demo', DATABASE_ROLE='ppe_demo_app', AUTO_CREATE_TABLES='false', DEBUG='false')
    for _ in range(2):
        migrated = subprocess.run([sys.executable, '-m', 'alembic', 'upgrade', 'head'],
            cwd=BACKEND, env=environment, capture_output=True, text=True)
        if migrated.returncode:
            # Only synthetic local credentials are used in this test.
            raise AssertionError(migrated.stderr)
    engine = create_engine(demo_url, pool_size=1, max_overflow=0)
    configure_schema_engine(engine, 'ppe_demo', 'ppe_demo_app')
    with engine.begin() as scoped:
        assert scoped.execute(text('SELECT count(*) FROM users')).scalar_one() == 0
        scoped.execute(text("INSERT INTO users (email, hashed_password, full_name, role) VALUES ('demo@example.com','synthetic','Demo','admin')"))
        assert scoped.execute(text('SELECT version_num FROM ppe_demo.alembic_version')).scalar_one() == '20260929_01'
        scoped.exec_driver_sql('SET search_path TO public')
    with engine.connect() as scoped:
        assert scoped.exec_driver_sql('SELECT current_schema()').scalar_one() == 'ppe_demo'
        scoped.rollback()
        assert scoped.exec_driver_sql('SELECT current_schema()').scalar_one() == 'ppe_demo'
        assert scoped.execute(text('SELECT count(*) FROM users')).scalar_one() == 1
    with connection.cursor() as cursor:
        cursor.execute('SELECT * FROM public.users')
        assert cursor.fetchall() == [(1, 'original data stays here')]
        cursor.execute('SELECT * FROM public.alembic_version')
        assert cursor.fetchall() == [('old-public-revision',)]
        cursor.execute("SELECT table_name FROM information_schema.tables WHERE table_schema='public'")
        assert {row[0] for row in cursor.fetchall()} == {'users', 'alembic_version', 'pg_stat_statements'}
        cursor.execute("SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='ppe_demo' AND c.relkind IN ('r','p')")
        assert {row[0] for row in cursor.fetchall()} == {
            'users', 'zones', 'detections', 'alerts', 'alert_deliveries', 'cameras',
            'safety_rules', 'violation_logs', 'daily_stats', 'user_settings',
            'settings_audit_logs', 'alembic_version'}
        cursor.execute("SELECT has_schema_privilege('anon','ppe_demo','USAGE'), has_schema_privilege('authenticated','ppe_demo','USAGE')")
        assert cursor.fetchone() == (False, False)
    connection.rollback()
    direct = psycopg2.connect(host='127.0.0.1', port=args.port, user='ppe_demo_app', password=password, dbname=database)
    for statement in ('SELECT * FROM public.users', "UPDATE public.users SET note='changed'", 'SELECT * FROM public.alembic_version'):
        try:
            with direct.cursor() as cursor:
                cursor.execute(statement)
            raise AssertionError('Old public data must be inaccessible')
        except psycopg2.errors.InsufficientPrivilege:
            direct.rollback()
    for grant, revoke in (
        ('GRANT SELECT ON public.users TO ppe_demo_app', 'REVOKE SELECT ON public.users FROM ppe_demo_app'),
        ('GRANT SELECT ON public.pg_stat_statements TO PUBLIC', 'REVOKE SELECT ON public.pg_stat_statements FROM PUBLIC'),
        ('GRANT USAGE ON SCHEMA ppe_demo TO anon', 'REVOKE USAGE ON SCHEMA ppe_demo FROM anon'),
    ):
        writer = direct if 'SCHEMA ppe_demo' in grant else connection
        with writer:
            with writer.cursor() as cursor:
                cursor.execute(grant)
        try:
            with engine.connect():
                raise AssertionError('Unsafe effective grants must reject pool checkout')
        except ValueError:
            pass
        with writer:
            with writer.cursor() as cursor:
                cursor.execute(revoke)
    admin_url = demo_url.set(username='postgres', password=None)
    wrong_role = create_engine(admin_url)
    configure_schema_engine(wrong_role, 'ppe_demo', 'ppe_demo_app')
    try:
        with wrong_role.connect():
            raise AssertionError('Postgres operator must not be accepted as demo login')
    except ValueError:
        pass
    wrong_role.dispose()
    engine.dispose()
    direct.close()
    connection.close()
    print('PostgreSQL schema integration passed: idempotent migrations, separate version/users, old data denied/preserved, pool scope restored, unsafe grants/admin login rejected.')


if __name__ == '__main__':
    main()
