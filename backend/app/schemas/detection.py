from pydantic import BaseModel
from typing import Optional, List, Any
from datetime import datetime


class DetectedObject(BaseModel):
    class_name: str
    confidence: float
    bbox: List[float]
    is_violation: bool = False


class DetectionResponse(BaseModel):
    id: int
    zone_id: Optional[int] = None
    original_image_path: str
    result_image_path: Optional[str] = None
    detected_objects: List[Any] = []
    violations: List[str] = []
    person_count: int = 0
    violation_count: int = 0
    has_violation: bool = False
    processing_time_ms: Optional[float] = None
    created_at: datetime

    class Config:
        from_attributes = True


class DetectionStats(BaseModel):
    total_detections: int
    total_persons: int
    total_violations: int
    compliance_rate: float
    violation_by_type: dict