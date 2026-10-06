"""One-time, additive demo schema/role setup; never migrate or change public tables.

Use the existing private backend .env ONLY for the operator connection. The
generated Render connection uses a separate password and is saved outside Git.
Default is read-only; --apply is required. Existing role/schema => refuse.
"""
import argparse
from pathlib import Path
import secrets
import sys

from dotenv import dotenv_values
import psycopg2
from psycopg2 import sql
from sqlalchemy.engine import make_url

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))
from app.core.database_scope import verify_role_permissions

SCHEMA = "ppe_demo"
ROLE = "ppe_demo_app"


def public_snapshot(cursor) -> tuple:
    """Compare old schema/ACL/version/row counts without logging any row contents."""
    cursor.execute("""SELECT c.oid, c.relname, c.relkind, c.relowner, c.relacl::text,
        a.attnum, a.attname, a.atttypid, a.atttypmod, a.attnotnull
        FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
        LEFT JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped
        WHERE n.nspname='public' ORDER BY c.oid, a.attnum""")
    layout = cursor.fetchall()
    cursor.execute("SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p') ORDER BY c.relname")
    tables = [row[0] for row in cursor.fetchall()]
    counts = []
    for table in tables:
        cursor.execute(sql.SQL('SELECT count(*) FROM public.{}').format(sql.Identifier(table)))
        counts.append((table, cursor.fetchone()[0]))
    version = []
    if 'alembic_version' in tables:
        cursor.execute('SELECT version_num FROM public.alembic_version ORDER BY version_num')
        version = cursor.fetchall()
    return (layout, counts, version)


def provision_schema(connection, password: str) -> None:
    """Create only new objects in one transaction; any failed isolation rolls back."""
    with connection:
        with connection.cursor() as cursor:
            before = public_snapshot(cursor)
            cursor.execute("SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = %s) OR EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = %s)", (ROLE, SCHEMA))
            if cursor.fetchone()[0]:
                raise ValueError("Demo role or schema already exists; refusing to reuse/overwrite")
            cursor.execute(sql.SQL("CREATE ROLE {} LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD {}").format(sql.Identifier(ROLE), sql.Literal(password)))
            # Managed Supabase postgres is NOT a superuser. PostgreSQL 16+ grants
            # the creator ADMIN but not necessarily SET on a new role. Temporarily
            # allow SET for schema ownership/default ACL DDL, never for the demo
            # role to inherit operator access. Remove SET before commit.
            cursor.execute('SELECT current_user, current_setting(\'server_version_num\')::integer')
            operator, version = cursor.fetchone()
            if version < 160000:
                raise ValueError('Demo provisioning requires PostgreSQL 16 or later')
            cursor.execute(sql.SQL('GRANT {} TO {} WITH SET TRUE, INHERIT FALSE').format(sql.Identifier(ROLE), sql.Identifier(operator)))
            cursor.execute(sql.SQL("GRANT CONNECT ON DATABASE {} TO {}").format(sql.Identifier(connection.info.dbname), sql.Identifier(ROLE)))
            cursor.execute(sql.SQL("CREATE SCHEMA {} AUTHORIZATION {}").format(sql.Identifier(SCHEMA), sql.Identifier(ROLE)))
            cursor.execute(sql.SQL("ALTER ROLE {} IN DATABASE {} SET search_path TO {}").format(sql.Identifier(ROLE), sql.Identifier(connection.info.dbname), sql.Identifier(SCHEMA)))
            cursor.execute(sql.SQL('SET LOCAL ROLE {}').format(sql.Identifier(ROLE)))
            cursor.execute(sql.SQL("REVOKE ALL ON SCHEMA {} FROM PUBLIC").format(sql.Identifier(SCHEMA)))
            cursor.execute("SELECT rolname FROM pg_roles WHERE rolname IN ('anon', 'authenticated')")
            api_roles = [row[0] for row in cursor.fetchall()]
            for recipient in ["PUBLIC", *api_roles]:
                target = sql.SQL("PUBLIC") if recipient == "PUBLIC" else sql.Identifier(recipient)
                cursor.execute(sql.SQL("REVOKE ALL ON SCHEMA {} FROM {}").format(sql.Identifier(SCHEMA), target))
                for kind in ("TABLES", "SEQUENCES"):
                    cursor.execute(sql.SQL("ALTER DEFAULT PRIVILEGES FOR ROLE {} IN SCHEMA {} REVOKE ALL ON {} FROM {}").format(sql.Identifier(ROLE), sql.Identifier(SCHEMA), sql.SQL(kind), target))
                # Functions have a global PUBLIC EXECUTE default; a per-schema
                # revoke alone would not remove that default for future functions.
                cursor.execute(sql.SQL("ALTER DEFAULT PRIVILEGES FOR ROLE {} REVOKE ALL ON FUNCTIONS FROM {}").format(sql.Identifier(ROLE), target))
            cursor.execute('RESET ROLE')
            cursor.execute(sql.SQL('REVOKE SET OPTION FOR {} FROM {}').format(sql.Identifier(ROLE), sql.Identifier(operator)))
            verify_role_permissions(cursor, SCHEMA, ROLE)
            if public_snapshot(cursor) != before:
                raise ValueError("Public snapshot changed; rolling back demo setup for review")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--project-ref", required=True)
    parser.add_argument("--secret-dir", type=Path)
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    url = make_url(dotenv_values(BACKEND / ".env").get("DATABASE_URL", ""))
    if (url.username != "postgres." + args.project_ref or not url.host
            or not url.host.endswith(".pooler.supabase.com") or url.port != 5432
            or url.database != "postgres" or url.query.get("sslmode") not in {"require", "verify-full", "verify-ca"}):
        raise ValueError("Expected approved Supabase TLS session-pooler operator connection")
    # Do not pass SQLAlchemy driver suffix/query encoding to psycopg2.
    connection = psycopg2.connect(host=url.host, port=url.port, dbname=url.database,
        user=url.username, password=url.password, sslmode=url.query["sslmode"], connect_timeout=20)
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = %s), EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = %s)", (ROLE, SCHEMA))
            if any(cursor.fetchone()):
                raise ValueError("Demo role/schema exists; stop for review")
        connection.rollback()
        if not args.apply:
            print("Read-only preflight passed; no role/schema created. --apply and a private --secret-dir are required.")
            return
        if not args.secret_dir or not args.secret_dir.is_absolute():
            raise ValueError("Choose an existing ACL-protected absolute private directory outside Git")
        directory = args.secret_dir.resolve(strict=True)
        if directory.is_relative_to(BACKEND.parent):
            raise ValueError("Secret output must stay outside the repository")
        password = secrets.token_urlsafe(40)
        demo_url = url.set(username=ROLE + "." + args.project_ref, password=password)
        # Persist before committing a role, so a file failure cannot lose its password.
        # Exclusive creation preserves any existing credential file; failed setup keeps
        # the file for review, but its connection is NOT usable until provisioning succeeds.
        output = directory / "render-demo.env"
        with output.open("x", encoding="utf-8") as stream:
            stream.write("DATABASE_URL=" + demo_url.render_as_string(hide_password=False) + "\n")
            stream.write("DATABASE_SCHEMA=ppe_demo\nDATABASE_ROLE=ppe_demo_app\n")
        provision_schema(connection, password)
        print("Created ppe_demo and dedicated ppe_demo_app; no public tables/migrations changed.")
        print("Render credentials saved privately in render-demo.env; never commit or paste into chat.")
    finally:
        connection.close()


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print("Demo schema preparation failed:", type(exc).__name__, "(no credentials logged)", file=sys.stderr)
        raise SystemExit(1)
