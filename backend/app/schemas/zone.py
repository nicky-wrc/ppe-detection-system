from pydantic import BaseModel, ConfigDict, Field, field_validator
from typing import Any, Optional, List
from datetime import datetime


class ZoneBase(BaseModel):
    name: str
    description: Optional[str] = None
    required_ppe: List[str] = Field(default_factory=list)
    polygon_points: List[List[float]] = Field(default_factory=list)
    risk_level: str = "medium"
    rules_config: dict[str, Any] = Field(default_factory=dict)

    @field_validator("required_ppe")
    @classmethod
    def validate_required_ppe(cls, value: List[str]) -> List[str]:
        unsupported = set(value) - {"helmet", "safety-vest"}
        if unsupported:
            raise ValueError(f"Unsupported PPE rules: {', '.join(sorted(unsupported))}")
        return list(dict.fromkeys(value))

    @field_validator("risk_level")
    @classmethod
    def validate_risk_level(cls, value: str) -> str:
        if value not in {"low", "medium", "high", "critical"}:
            raise ValueError("risk_level must be low, medium, high, or critical")
        return value


class ZoneCreate(ZoneBase):
    pass


class ZoneUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    required_ppe: Optional[List[str]] = None
    polygon_points: Optional[List[List[float]]] = None
    risk_level: Optional[str] = None
    rules_config: Optional[dict[str, Any]] = None
    is_active: Optional[bool] = None

    @field_validator("required_ppe")
    @classmethod
    def validate_required_ppe(cls, value: Optional[List[str]]) -> Optional[List[str]]:
        if value is None:
            return value
        unsupported = set(value) - {"helmet", "safety-vest"}
        if unsupported:
            raise ValueError(f"Unsupported PPE rules: {', '.join(sorted(unsupported))}")
        return list(dict.fromkeys(value))

    @field_validator("risk_level")
    @classmethod
    def validate_risk_level(cls, value: Optional[str]) -> Optional[str]:
        if value is not None and value not in {"low", "medium", "high", "critical"}:
            raise ValueError("risk_level must be low, medium, high, or critical")
        return value


class ZoneResponse(ZoneBase):
    id: int
    is_active: bool
    total_violations: int = 0
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
