from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

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


def init_db():
    """
    สร้างตารางทั้งหมดตาม SQLAlchemy models
    ต้อง import app.models ก่อน เพื่อให้ metadata ของ models ถูก register
    """
    # นำเข้า models ทั้งหมดให้ SQLAlchemy เห็นตาราง
    import app.models  # noqa: F401

    Base.metadata.create_all(bind=engine)