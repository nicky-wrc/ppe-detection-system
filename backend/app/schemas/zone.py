from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class ZoneBase(BaseModel):
    name: str
    description: Optional[str] = None
    required_ppe: List[str] = []


class ZoneCreate(ZoneBase):
    pass


class ZoneUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    required_ppe: Optional[List[str]] = None
    is_active: Optional[bool] = None


class ZoneResponse(ZoneBase):
    id: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True