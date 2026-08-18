from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field, model_validator


class CameraBase(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    source_type: Literal["usb", "rtsp", "file"] = "usb"
    device_index: int | None = Field(default=0, ge=0, le=32)
    rtsp_url: str | None = Field(default=None, max_length=500)
    location: str | None = Field(default=None, max_length=200)
    zone_id: int | None = None
    config: dict[str, Any] = Field(default_factory=dict)

    @model_validator(mode="after")
    def validate_source(self):
        if self.source_type == "usb" and self.device_index is None:
            raise ValueError("device_index is required for a USB camera")
        if self.source_type == "rtsp" and not self.rtsp_url:
            raise ValueError("rtsp_url is required for an RTSP camera")
        return self


class CameraCreate(CameraBase):
    pass


class CameraUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=100)
    device_index: int | None = Field(default=None, ge=0, le=32)
    rtsp_url: str | None = Field(default=None, max_length=500)
    location: str | None = Field(default=None, max_length=200)
    zone_id: int | None = None
    is_active: bool | None = None
    config: dict[str, Any] | None = None


class CameraResponse(CameraBase):
    id: int
    owner_id: int | None = None
    is_active: bool
    is_online: bool
    last_seen: datetime | None = None
    started_at: datetime | None = None
    last_error: str | None = None
    measured_fps: float = 0.0
    frames_analyzed: int = 0
    created_at: datetime

    model_config = {"from_attributes": True, "protected_namespaces": ()}


class CameraTestResponse(BaseModel):
    ok: bool
    width: int | None = None
    height: int | None = None
    fps: float | None = None
    error: str | None = None


class CameraDeviceResponse(BaseModel):
    device_index: int
    label: str
    width: int | None = None
    height: int | None = None
    fps: float | None = None
    backend_name: str | None = None


class ViolationEventResponse(BaseModel):
    id: int
    user_id: int | None = None
    camera_id: int | None = None
    zone_id: int | None = None
    detection_id: int | None = None
    violation_type: str
    track_id: int | None = None
    confidence_score: int
    person_count: int
    snapshot_path: str | None = None
    evidence_clip_path: str | None = None
    bbox_data: Any | None = None
    model_version: str | None = None
    status: str
    acknowledged_by: int | None = None
    acknowledged_at: datetime | None = None
    resolved_by: int | None = None
    resolved_at: datetime | None = None
    notes: str | None = None
    first_seen: datetime | None = None
    last_seen: datetime | None = None
    created_at: datetime

    model_config = {"from_attributes": True, "protected_namespaces": ()}


class ViolationEventResolve(BaseModel):
    notes: str | None = Field(default=None, max_length=2000)
