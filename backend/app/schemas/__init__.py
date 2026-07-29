from app.schemas.user import (
    UserBase,
    UserCreate,
    UserLogin,
    UserResponse,
    Token,
    ForgotPasswordRequest,
    ForgotPasswordConfirmRequest,
    AdminUserCreate,
    AdminUserUpdate,
)
from app.schemas.zone import ZoneBase, ZoneCreate, ZoneUpdate, ZoneResponse
from app.schemas.detection import DetectedObject, DetectionResponse, DetectionStats
from app.schemas.alert import AlertBase, AlertCreate, AlertResolve, AlertResponse
from app.schemas.settings import UserSettingsBase, UserSettingsUpdate, UserSettingsResponse
from app.schemas.camera import (
    CameraCreate,
    CameraUpdate,
    CameraResponse,
    CameraTestResponse,
    ViolationEventResponse,
    ViolationEventResolve,
)
