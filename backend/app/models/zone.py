from sqlalchemy import Column, Integer, String, Boolean, DateTime, JSON, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class Zone(Base):
    """โซนพื้นที่ตรวจจับ"""
    __tablename__ = "zones"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    
    # Polygon coordinates for zone boundary [[x1,y1], [x2,y2], ...]
    polygon_points = Column(JSON, default=[])
    
    # Required PPE in this zone
    required_ppe = Column(JSON, default=[])  # ["hardhat", "vest", "mask"]
    
    # Rules configuration
    rules_config = Column(JSON, default={})
    
    # Zone status
    is_active = Column(Boolean, default=True)
    risk_level = Column(String(20), default="medium")  # low, medium, high, critical
    
    # Stats
    total_violations = Column(Integer, default=0)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    cameras = relationship("Camera", back_populates="zone")
    violation_logs = relationship("ViolationLog", back_populates="zone")
