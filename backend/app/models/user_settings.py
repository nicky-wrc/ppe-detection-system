from sqlalchemy import Column, Integer, Boolean, DateTime, JSON, ForeignKey
from sqlalchemy.sql import func
from app.core.database import Base


class UserSettings(Base):
    __tablename__ = "user_settings"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, index=True, nullable=False)

    # UI / behavior preferences
    alert_sound = Column(Boolean, default=True)
    save_evidence = Column(Boolean, default=True)

    # Detection tuning (stored as percent for the UI; backend may map to internal thresholds later)
    confidence_threshold = Column(Integer, default=45)  # 30..90
    ppe_detection_sensitivity = Column(Integer, default=60)  # 35..75

    # PPE rules toggles (keys like "helmet", "safety-vest", "glasses"...)
    active_ppe_rules = Column(JSON, default=dict)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class SettingsAuditLog(Base):
    __tablename__ = "settings_audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    changed_by = Column(Integer, ForeignKey("users.id"), index=True, nullable=True)
    old_values = Column(JSON, nullable=False, default=dict)
    new_values = Column(JSON, nullable=False, default=dict)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
