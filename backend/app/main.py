import asyncio
import json
import logging
import time
import uuid
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import PlainTextResponse
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.database import SessionLocal, init_db
from app.core.security import get_password_hash
from app.models import Camera, User
from app.services.camera_runtime import camera_runtime
from app.services.retention_service import retention_loop

class JsonLogFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        return json.dumps(
            {
                "timestamp": self.formatTime(record, "%Y-%m-%dT%H:%M:%S%z"),
                "level": record.levelname,
                "logger": record.name,
                "message": record.getMessage(),
            },
            ensure_ascii=False,
        )


handler = logging.StreamHandler()
handler.setFormatter(
    JsonLogFormatter()
    if settings.ENVIRONMENT == "production"
    else logging.Formatter("%(asctime)s %(levelname)s %(name)s %(message)s")
)
logging.basicConfig(level=logging.DEBUG if settings.DEBUG else logging.INFO, handlers=[handler], force=True)
logger = logging.getLogger(__name__)
DATA_ACCESS_POLICY = "organization-shared-read-v1"


@asynccontextmanager
async def lifespan(_: FastAPI):
    Path(settings.UPLOAD_DIR).mkdir(parents=True, exist_ok=True)
    Path(settings.EVIDENCE_DIR).mkdir(parents=True, exist_ok=True)
    if settings.AUTO_CREATE_TABLES:
        init_db()

    if settings.BOOTSTRAP_ADMIN_EMAIL and settings.BOOTSTRAP_ADMIN_PASSWORD:
        db = SessionLocal()
        try:
            admin = db.query(User).filter(User.email == settings.BOOTSTRAP_ADMIN_EMAIL).first()
            if admin is None:
                db.add(
                    User(
                        email=settings.BOOTSTRAP_ADMIN_EMAIL,
                        hashed_password=get_password_hash(settings.BOOTSTRAP_ADMIN_PASSWORD),
                        full_name="System Administrator",
                        role="admin",
                    )
                )
                db.commit()
                logger.info("Bootstrapped the configured administrator account")
        finally:
            db.close()
    db = SessionLocal()
    try:
        active_camera_ids = [camera.id for camera in db.query(Camera).filter(Camera.is_active.is_(True)).all()]
    finally:
        db.close()
    if settings.ENVIRONMENT == "research_demo":
        active_camera_ids = []  # Cloud demo has browser cameras only, never server USB/RTSP.
    for camera_id in active_camera_ids:
        await camera_runtime.start(camera_id)
    if active_camera_ids:
        logger.info("Resumed %s active camera runtime task(s)", len(active_camera_ids))

    retention_task = asyncio.create_task(retention_loop(), name="evidence-retention")
    yield
    retention_task.cancel()
    try:
        await retention_task
    except asyncio.CancelledError:
        pass
    await camera_runtime.stop_all()


app = FastAPI(
    title=settings.PROJECT_NAME,
    description="ระบบตรวจจับการสวมใส่อุปกรณ์ป้องกันความปลอดภัยแบบอัตโนมัติ",
    version="2.0.0",
    docs_url="/docs" if settings.ENVIRONMENT in {"development", "test"} else None,
    redoc_url="/redoc" if settings.ENVIRONMENT in {"development", "test"} else None,
    openapi_url="/openapi.json" if settings.ENVIRONMENT in {"development", "test"} else None,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Bootstrap-Token"],
)

app.include_router(api_router, prefix=settings.API_V1_PREFIX)

demo_frame_lock = asyncio.Lock()


@app.middleware("http")
async def research_demo_boundary(request: Request, call_next):
    """A controlled stateless browser-camera trial, not a multi-factory deployment."""
    if settings.ENVIRONMENT != "research_demo":
        return await call_next(request)
    path = request.url.path.rstrip("/")
    api_prefix = settings.API_V1_PREFIX
    if path == "/metrics" or path.startswith(f"{api_prefix}/cameras"):
        return JSONResponse(status_code=403, content={"detail": "Native camera and metrics access is disabled in this research demo"})
    if request.method == "POST" and (path.startswith(f"{api_prefix}/auth/forgot-password") or path in {
        f"{api_prefix}/detection/image", f"{api_prefix}/detection/video",
        f"{api_prefix}/detection/frame/compliant-report",
        f"{api_prefix}/auth/forgot-password", f"{api_prefix}/auth/reset-password",
    }):
        return JSONResponse(status_code=403, content={"detail": "Persistent media and password reset are disabled in this research demo"})
    if request.method == "POST" and path == f"{api_prefix}/detection/frame":
        content_length = request.headers.get("content-length")
        if content_length is not None:
            try:
                if int(content_length) < 0 or int(content_length) > settings.MAX_FRAME_SIZE + 65536:
                    return JSONResponse(status_code=413, content={"detail": "Demo frame is too large"})
            except ValueError:
                return JSONResponse(status_code=400, content={"detail": "Invalid content length"})
        if demo_frame_lock.locked():
            return JSONResponse(status_code=429, content={"detail": "Demo inference is busy; try again shortly"}, headers={"Retry-After": "2"})
        async with demo_frame_lock:
            response = await call_next(request)
    else:
        response = await call_next(request)
    if response.status_code >= 500:
        return JSONResponse(status_code=response.status_code, content={"detail": "Demo service unavailable; try again later"})
    return response


@app.middleware("http")
async def request_context(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID") or uuid.uuid4().hex
    started = time.perf_counter()
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    logger.info(
        "request_id=%s method=%s path=%s status=%s duration_ms=%.2f",
        request_id,
        request.method,
        request.url.path,
        response.status_code,
        (time.perf_counter() - started) * 1000,
    )
    return response


@app.get("/")
async def root():
    return {"message": "PPE Detection System API", "version": "2.0.0", "docs": app.docs_url}


@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "cloud_browser_recording": settings.CLOUD_BROWSER_RECORDING,
        "environment": settings.ENVIRONMENT,
        "data_access_policy": DATA_ACCESS_POLICY,
    }


@app.get("/ready")
async def ready():
    from sqlalchemy import text

    db = SessionLocal()
    try:
        db.execute(text("SELECT 1"))
        return {"status": "ready", "database": "ok"}
    finally:
        db.close()


@app.get("/metrics", response_class=PlainTextResponse)
async def metrics():
    from app.models import Camera, ViolationLog

    db = SessionLocal()
    try:
        cameras = db.query(Camera).all()
        event_count = db.query(ViolationLog).count()
        lines = [
            "# HELP ppe_violation_events_total Persisted PPE violation events.",
            "# TYPE ppe_violation_events_total gauge",
            f"ppe_violation_events_total {event_count}",
            "# HELP ppe_camera_online Camera online state.",
            "# TYPE ppe_camera_online gauge",
        ]
        for camera in cameras:
            safe_name = camera.name.replace("\\", "\\\\").replace('"', '\\"')
            lines.append(f'ppe_camera_online{{camera_id="{camera.id}",name="{safe_name}"}} {1 if camera.is_online else 0}')
            lines.append(f'ppe_camera_analyzed_fps{{camera_id="{camera.id}"}} {float(camera.measured_fps or 0)}')
            lines.append(f'ppe_camera_frames_analyzed_total{{camera_id="{camera.id}"}} {int(camera.frames_analyzed or 0)}')
        return "\n".join(lines) + "\n"
    finally:
        db.close()
