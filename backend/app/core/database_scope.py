"""PostgreSQL schema boundary shared by the ORM and Alembic.

A search path is routing, not authorization: verify a dedicated role as well.
Never fall back to public when the requested schema or isolation is missing.
"""
import re

from sqlalchemy import event
from sqlalchemy.engine import Engine


def validate_schema_name(schema: str) -> str:
    if not re.fullmatch(r"[a-z][a-z0-9_]{0,62}", schema) or schema == "public" or schema.startswith("pg_") or schema in {"auth", "storage", "extensions", "information_schema"}:
        raise ValueError("Choose a non-system lowercase database schema")
    return schema


def verify_role_permissions(cursor, schema: str, role: str) -> None:
    """Audit explicit role permissions, also usable inside the provisioning transaction."""
    cursor.execute("""
        SELECT r.rolsuper OR r.rolcreatedb OR r.rolcreaterole OR r.rolreplication OR r.rolbypassrls,
               EXISTS (SELECT 1 FROM pg_auth_members WHERE member = r.oid),
               EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = %s AND nspowner = r.oid)
        FROM pg_roles r WHERE rolname = %s
    """, (schema, role))
    result = cursor.fetchone()
    if not result or result[0] or result[1] or not result[2]:
        raise ValueError("Demo connection requires its dedicated unprivileged schema owner")
    cursor.execute("""
        SELECT EXISTS (
            SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname <> %s AND n.nspname NOT LIKE 'pg_%%'
              AND n.nspname <> 'information_schema'
              -- Supabase exposes these built-in extension statistics views to
              -- PUBLIC. They hide other roles' query text for unprivileged users.
              -- Match extension ownership, not merely a spoofable view name.
              AND NOT EXISTS (
                  SELECT 1 FROM pg_depend d JOIN pg_extension e ON e.oid=d.refobjid
                  WHERE d.classid='pg_class'::regclass AND d.objid=c.oid AND d.deptype='e'
                    AND e.extname='pg_stat_statements' AND c.relkind='v'
                    AND c.relname IN ('pg_stat_statements', 'pg_stat_statements_info')
              )
              AND CASE WHEN c.relkind IN ('r','p','v','m','f') THEN
                    has_table_privilege(%s, c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
                   WHEN c.relkind = 'S' THEN has_sequence_privilege(%s, c.oid, 'USAGE,SELECT,UPDATE')
                   ELSE false END
        ) OR EXISTS (
            SELECT 1 FROM pg_namespace n WHERE n.nspname <> %s
              AND n.nspname NOT LIKE 'pg_%%' AND n.nspname <> 'information_schema'
              AND has_schema_privilege(%s, n.oid, 'CREATE')
        ) OR EXISTS (
            SELECT 1 FROM pg_roles r WHERE r.rolname IN ('anon','authenticated')
              AND has_schema_privilege(r.oid, %s, 'USAGE,CREATE')
        ) OR has_database_privilege(%s, current_database(), 'CREATE')
    """, (schema, role, role, schema, role, schema, role))
    if cursor.fetchone()[0]:
        raise ValueError("Demo isolation failed: outside data access or Data API schema access")


def verify_isolated_role(cursor, schema: str, role: str) -> None:
    """Fail closed before SQL if login/search path differs from the declared scope."""
    cursor.execute("SELECT current_user, session_user, current_schema()")
    if cursor.fetchone() != (role, role, schema):
        raise ValueError("Demo connection requires its dedicated unprivileged schema owner")
    verify_role_permissions(cursor, schema, role)


def configure_schema_engine(engine: Engine, schema: str | None, role: str | None) -> None:
    """Restore and verify scope on EVERY pool checkout, before any app/migration SQL."""
    if not schema:
        return
    validate_schema_name(schema)
    if engine.dialect.name != "postgresql" or engine.dialect.driver != "psycopg2":
        raise ValueError("Schema isolation requires PostgreSQL with psycopg2")
    if not role:
        raise ValueError("Schema isolation requires DATABASE_ROLE")

    @event.listens_for(engine, "checkout")
    def set_scope(dbapi_connection, connection_record, connection_proxy):
        previous = dbapi_connection.autocommit
        # Commit session configuration independently of request rollback.
        dbapi_connection.autocommit = True
        try:
            with dbapi_connection.cursor() as cursor:
                cursor.execute("SELECT set_config('search_path', %s, false)", (schema,))
                verify_isolated_role(cursor, schema, role)
                engine.dialect.default_schema_name = schema
        finally:
            dbapi_connection.autocommit = previous
