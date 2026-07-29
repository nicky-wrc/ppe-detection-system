import asyncio
import json
import logging
import time
import uuid
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import PlainTextResponse
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.database import SessionLocal, init_db
from app.core.security import get_password_hash
from app.models import User
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
    docs_url="/docs" if settings.ENVIRONMENT != "production" else None,
    redoc_url="/redoc" if settings.ENVIRONMENT != "production" else None,
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
    return {"status": "healthy", "environment": settings.ENVIRONMENT}


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
