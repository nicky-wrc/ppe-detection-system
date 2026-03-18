from pydantic import BaseModel, Field
from typing import Dict
from datetime import datetime


class UserSettingsBase(BaseModel):
    alert_sound: bool = True
    save_evidence: bool = True
    confidence_threshold: int = Field(default=50, ge=0, le=100)
    ppe_detection_sensitivity: int = Field(default=60, ge=0, le=100)
    active_ppe_rules: Dict[str, bool] = {}


class UserSettingsUpdate(BaseModel):
    alert_sound: bool | None = None
    save_evidence: bool | None = None
    confidence_threshold: int | None = Field(default=None, ge=0, le=100)
    ppe_detection_sensitivity: int | None = Field(default=None, ge=0, le=100)
    active_ppe_rules: Dict[str, bool] | None = None


class UserSettingsResponse(UserSettingsBase):
    id: int
    user_id: int
    created_at: datetime

    class Config:
        from_attributes = True

