from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class AlertBase(BaseModel):
    detection_id: int
    alert_type: str
    message: Optional[str] = None


class AlertCreate(AlertBase):
    pass


class AlertResolve(BaseModel):
    resolution_note: Optional[str] = None


class AlertResponse(AlertBase):
    id: int
    status: str
    acknowledged_by: Optional[int] = None
    acknowledged_at: Optional[datetime] = None
    resolved_by: Optional[int] = None
    resolved_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True