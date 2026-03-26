from sqlalchemy import create_engine, inspect, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

"""
Database configuration.

ค่าเริ่มต้นใน Settings ใช้ DATABASE_URL จาก environment ถ้าไม่ได้ตั้งค่า
ให้ default เป็น SQLite (เหมาะสำหรับโปรเจคจบ/เดโม เพราะไม่ต้องตั้งค่า PostgreSQL)
"""

engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _get_column_ddl(column) -> str:
    """Get the DDL type string for a SQLAlchemy column."""
    try:
        return column.type.compile(dialect=engine.dialect)
    except Exception:
        return str(column.type)


def migrate_db():
    """
    ตรวจสอบตารางที่มีอยู่แล้ว แล้วเพิ่ม column ที่ขาดหายไป
    (เพราะ create_all จะไม่ ALTER ตารางที่มีอยู่แล้ว)
    """
    inspector = inspect(engine)
    existing_tables = inspector.get_table_names()

    for table_name, table in Base.metadata.tables.items():
        if table_name not in existing_tables:
            continue  # create_all will handle new tables

        existing_columns = {col["name"] for col in inspector.get_columns(table_name)}

        for column in table.columns:
            if column.name not in existing_columns:
                col_type = _get_column_ddl(column)
                # Build ALTER TABLE statement
                default_clause = ""
                if column.default is not None:
                    default_val = column.default.arg
                    if isinstance(default_val, bool):
                        default_clause = f" DEFAULT {'TRUE' if default_val else 'FALSE'}"
                    elif isinstance(default_val, (int, float)):
                        default_clause = f" DEFAULT {default_val}"
                    elif isinstance(default_val, str):
                        default_clause = f" DEFAULT '{default_val}'"
                    elif isinstance(default_val, (list, dict)):
                        import json
                        default_clause = f" DEFAULT '{json.dumps(default_val)}'"
                elif column.server_default is not None:
                    default_clause = f" DEFAULT {column.server_default.arg.text if hasattr(column.server_default.arg, 'text') else column.server_default.arg}"

                nullable = "" if column.nullable else " NOT NULL"

                sql = f"ALTER TABLE {table_name} ADD COLUMN {column.name} {col_type}{nullable}{default_clause}"
                logger.info(f"Migration: {sql}")
                try:
                    with engine.connect() as conn:
                        conn.execute(text(sql))
                        conn.commit()
                    logger.info(f"Added column '{column.name}' to table '{table_name}'")
                except Exception as e:
                    logger.warning(f"Could not add column '{column.name}' to '{table_name}': {e}")


def init_db():
    """
    สร้างตารางทั้งหมดตาม SQLAlchemy models
    ต้อง import app.models ก่อน เพื่อให้ metadata ของ models ถูก register
    """
    # นำเข้า models ทั้งหมดให้ SQLAlchemy เห็นตาราง
    import app.models  # noqa: F401

    Base.metadata.create_all(bind=engine)

    # Migrate existing tables - add any missing columns
    migrate_db()