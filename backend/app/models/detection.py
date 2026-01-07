from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, JSON, ForeignKey
from sqlalchemy.sql import func
from app.core.database import Base


class Detection(Base):
    __tablename__ = "detections"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    zone_id = Column(Integer, ForeignKey("zones.id"), nullable=True)
    
    original_image_path = Column(String(500), nullable=False)
    result_image_path = Column(String(500), nullable=True)
    
    detected_objects = Column(JSON, default=list)
    violations = Column(JSON, default=list)
    person_count = Column(Integer, default=0)
    violation_count = Column(Integer, default=0)
    
    has_violation = Column(Boolean, default=False)
    processing_time_ms = Column(Float, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())