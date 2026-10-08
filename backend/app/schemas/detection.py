from pydantic import BaseModel, ConfigDict, Field
from typing import Optional, List, Any, Dict
from datetime import datetime


class DetectedObject(BaseModel):
    class_id: int = 0
    class_name: str
    class_name_thai: Optional[str] = None
    confidence: float
    bbox: List[float]
    is_violation: bool = False
    is_person: bool = False


class PersonPPEStatus(BaseModel):
    """สถานะ PPE ของแต่ละคน"""
    id: int
    bbox: List[float]
    confidence: float
    wearing: List[str] = Field(default_factory=list)          # อุปกรณ์ที่ใส่
    not_wearing: List[str] = Field(default_factory=list)      # อุปกรณ์ที่ไม่ใส่
    is_compliant: bool = True        # ปฏิบัติตามกฎหรือไม่


class DetectionSummary(BaseModel):
    """สรุปผลการตรวจจับ"""
    message: str
    status: str  # "compliant", "violation", "no_person", "error"
    total_persons: int = 0
    compliant_persons: int = 0
    non_compliant_persons: int = 0
    violation_breakdown: Dict[str, int] = Field(default_factory=dict)


class BrowserPerformance(BaseModel):
    """Client-observed camera session measurements, not model accuracy."""
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)

    api_host: str = Field(min_length=1, max_length=253, pattern=r"^[a-zA-Z0-9.\[\]:-]+$")
    elapsed_ms: float = Field(gt=0, le=86400000)
    completed: int = Field(ge=1, le=1000000)
    failed: int = Field(ge=0, le=1000000)
    skipped: int = Field(ge=0, le=1000000)
    processing_ms: float = Field(ge=0, le=3600000)
    delay_ms: float = Field(ge=0, le=3600000)
    target_interval_ms: float = Field(gt=0, le=60000)


class DetectionResponse(BaseModel):
    id: int
    zone_id: Optional[int] = None
    original_image_path: str
    result_image_path: Optional[str] = None
    result_video_path: Optional[str] = None
    detected_objects: List[Any] = Field(default_factory=list)
    persons: List[Any] = Field(default_factory=list)          # รายการคนพร้อมสถานะ PPE
    violations: List[str] = Field(default_factory=list)
    person_count: int = 0
    violation_count: int = 0
    has_violation: bool = False
    processing_time_ms: Optional[float] = None
    summary: Optional[Dict[str, Any]] = None  # สรุปผลการตรวจจับ
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DetectionStats(BaseModel):
    total_detections: int
    total_persons: int
    total_violations: int
    compliance_rate: float
    violation_by_type: dict
