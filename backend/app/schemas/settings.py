from pydantic import BaseModel, ConfigDict, Field
from typing import Dict
from datetime import datetime


class UserSettingsBase(BaseModel):
    alert_sound: bool = True
    save_evidence: bool = True
    confidence_threshold: int = Field(default=25, ge=10, le=90)
    ppe_detection_sensitivity: int = Field(default=60, ge=0, le=100)
    active_ppe_rules: Dict[str, bool] = Field(default_factory=dict)


class UserSettingsUpdate(BaseModel):
    alert_sound: bool | None = None
    save_evidence: bool | None = None
    confidence_threshold: int | None = Field(default=None, ge=10, le=90)
    ppe_detection_sensitivity: int | None = Field(default=None, ge=0, le=100)
    active_ppe_rules: Dict[str, bool] | None = None


class UserSettingsResponse(UserSettingsBase):
    id: int
    user_id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

