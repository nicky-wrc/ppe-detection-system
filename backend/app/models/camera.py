from sqlalchemy import Column, Integer, String, Boolean, DateTime, JSON, ForeignKey, Text, Float
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class Camera(Base):
    """กล้อง CCTV/IP Camera"""
    __tablename__ = "cameras"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    source_type = Column(String(20), default="usb", nullable=False)  # usb, rtsp, file
    device_index = Column(Integer, nullable=True)
    rtsp_url = Column(String(500), nullable=True)  # RTSP URL for live streaming
    location = Column(String(200), nullable=True)
    zone_id = Column(Integer, ForeignKey("zones.id"), nullable=True)
    
    # Camera status
    is_active = Column(Boolean, default=True)
    is_online = Column(Boolean, default=False)
    last_seen = Column(DateTime(timezone=True), nullable=True)
    started_at = Column(DateTime(timezone=True), nullable=True)
    last_error = Column(Text, nullable=True)
    measured_fps = Column(Float, default=0.0)
    frames_analyzed = Column(Integer, default=0)
    
    # Configuration JSON (active rules, settings)
    config = Column(JSON, default=dict)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    zone = relationship("Zone", back_populates="cameras")
    violation_logs = relationship("ViolationLog", back_populates="camera")


class SafetyRule(Base):
    """กฎความปลอดภัย PPE"""
    __tablename__ = "safety_rules"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)  # e.g., "Hard Hat Required"
    code = Column(String(50), unique=True, nullable=False)  # e.g., "hardhat_required"
    description = Column(Text, nullable=True)
    ppe_type = Column(String(50), nullable=False)  # hardhat, vest, mask, goggles, gloves
    is_active = Column(Boolean, default=True)
    severity = Column(String(20), default="medium")  # low, medium, high, critical
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class ViolationLog(Base):
    """บันทึกการฝ่าฝืน"""
    __tablename__ = "violation_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    camera_id = Column(Integer, ForeignKey("cameras.id"), nullable=True, index=True)
    zone_id = Column(Integer, ForeignKey("zones.id"), nullable=True, index=True)
    detection_id = Column(Integer, ForeignKey("detections.id"), nullable=True, index=True)
    
    violation_type = Column(String(50), nullable=False, index=True)  # no_hardhat, no_vest
    track_id = Column(Integer, nullable=True, index=True)
    confidence_score = Column(Integer, default=0)  # 0-100
    person_count = Column(Integer, default=1)
    
    # Evidence
    snapshot_path = Column(String(500), nullable=True)
    evidence_clip_path = Column(String(500), nullable=True)
    bbox_data = Column(JSON, nullable=True)  # Bounding box coordinates
    model_version = Column(String(100), nullable=True)
    
    # Status
    status = Column(String(20), default="new", index=True)  # new, acknowledged, resolved
    acknowledged_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    acknowledged_at = Column(DateTime(timezone=True), nullable=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    resolved_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    notes = Column(Text, nullable=True)
    first_seen = Column(DateTime(timezone=True), nullable=True)
    last_seen = Column(DateTime(timezone=True), nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    # Relationships
    camera = relationship("Camera", back_populates="violation_logs")
    zone = relationship("Zone", back_populates="violation_logs")


class DailyStats(Base):
    """สถิติรายวัน"""
    __tablename__ = "daily_stats"

    id = Column(Integer, primary_key=True, index=True)
    date = Column(DateTime(timezone=True), nullable=False, index=True, unique=True)
    
    total_detections = Column(Integer, default=0)
    total_persons = Column(Integer, default=0)
    total_violations = Column(Integer, default=0)
    
    # Violation breakdown
    no_hardhat_count = Column(Integer, default=0)
    no_vest_count = Column(Integer, default=0)
    no_mask_count = Column(Integer, default=0)
    other_violations = Column(Integer, default=0)
    
    # Compliance
    compliance_rate = Column(Integer, default=100)  # 0-100%
    
    # By zone (JSON)
    zone_stats = Column(JSON, default=dict)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
