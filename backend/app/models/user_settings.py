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
    confidence_threshold = Column(Integer, default=25)  # 10..90
    ppe_detection_sensitivity = Column(Integer, default=60)  # 10..90

    # PPE rules toggles (keys like "helmet", "safety-vest", "glasses"...)
    active_ppe_rules = Column(JSON, default=dict)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

