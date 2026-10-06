from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

from app.core.config import settings
from app.core.database import Base
from app.core.database_scope import configure_schema_engine
import app.models  # noqa: F401

config = context.config
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL.replace("%", "%%"))
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    if settings.DATABASE_SCHEMA:
        raise ValueError("Isolated schema migrations require an online connection for role verification")
    context.configure(
        url=settings.DATABASE_URL,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    configure_schema_engine(connectable, settings.DATABASE_SCHEMA, settings.DATABASE_ROLE)
    with connectable.connect() as connection:
        if settings.DATABASE_SCHEMA:
            # Reflection must inspect the same default schema as unqualified DDL.
            connection.dialect.default_schema_name = settings.DATABASE_SCHEMA
        context.configure(connection=connection, target_metadata=target_metadata, compare_type=True,
                          version_table_schema=settings.DATABASE_SCHEMA)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
