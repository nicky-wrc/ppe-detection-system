from pydantic import BaseModel, ConfigDict, Field
from typing import Literal
from typing import Dict
from datetime import datetime


class UserSettingsBase(BaseModel):
    alert_sound: bool = True
    save_evidence: bool = True
    confidence_threshold: int = Field(default=45, ge=30, le=90)
    ppe_detection_sensitivity: int = Field(default=60, ge=35, le=100)
    active_ppe_rules: Dict[str, bool] = Field(default_factory=dict)
    detection_record_mode: Literal["both", "violations_only", "compliant_only"] = "both"
    detection_cooldown_seconds: Literal[10, 15, 30, 45, 60] = 30


class UserSettingsUpdate(BaseModel):
    alert_sound: bool | None = None
    save_evidence: bool | None = None
    confidence_threshold: int | None = Field(default=None, ge=30, le=90)
    ppe_detection_sensitivity: int | None = Field(default=None, ge=35, le=100)
    active_ppe_rules: Dict[str, bool] | None = None
    detection_record_mode: Literal["both", "violations_only", "compliant_only"] | None = None
    detection_cooldown_seconds: Literal[10, 15, 30, 45, 60] | None = None


class UserSettingsResponse(UserSettingsBase):
    id: int
    user_id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
