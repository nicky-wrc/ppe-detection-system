from fastapi import APIRouter
from app.api.v1.endpoints import admin, alerts, auth, cameras, detection, events, models, realtime, settings, zones

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(detection.router, prefix="/detection", tags=["Detection"])
api_router.include_router(zones.router, prefix="/zones", tags=["Zones"])
api_router.include_router(alerts.router, prefix="/alerts", tags=["Alerts"])
api_router.include_router(settings.router, prefix="/settings", tags=["Settings"])
api_router.include_router(cameras.router, prefix="/cameras", tags=["Cameras"])
api_router.include_router(events.router, prefix="/events", tags=["Violation Events"])
api_router.include_router(admin.router, prefix="/admin", tags=["Administration"])
api_router.include_router(realtime.router, prefix="/ws", tags=["Realtime"])
api_router.include_router(models.router, prefix="/models", tags=["Models"])
