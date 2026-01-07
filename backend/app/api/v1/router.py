from fastapi import APIRouter
from app.api.v1.endpoints import auth, detection, zones, alerts

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(detection.router, prefix="/detection", tags=["Detection"])
api_router.include_router(zones.router, prefix="/zones", tags=["Zones"])
api_router.include_router(alerts.router, prefix="/alerts", tags=["Alerts"])