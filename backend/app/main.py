from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from app.core.config import settings
from app.core.database import init_db, SessionLocal
from app.core.security import get_password_hash
from app.api.v1.router import api_router
from app.models import User

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="ระบบตรวจจับการสวมใส่อุปกรณ์ป้องกันความปลอดภัยแบบอัตโนมัติ",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS: เปิดให้ทุก origin เรียกได้ (เพื่อความง่ายในการพัฒนาโปรเจคจบ)
# ต้องตั้ง allow_credentials=False เมื่อใช้ allow_origins=["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.API_V1_PREFIX)

uploads_path = Path(settings.UPLOAD_DIR)
uploads_path.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(uploads_path)), name="uploads")


@app.on_event("startup")
async def startup():
    init_db()

    db = SessionLocal()
    try:
        admin_exists = db.query(User).filter(User.role == "admin").first()
        if not admin_exists:
            admin = User(
                email="admin@ppe-system.com",
                hashed_password=get_password_hash("admin123"),
                full_name="System Admin",
                role="admin",
            )
            db.add(admin)
            db.commit()
            db.refresh(admin)
    finally:
        db.close()


@app.get("/")
async def root():
    return {
        "message": "PPE Detection System API",
        "version": "1.0.0",
        "docs": "/docs"
    }


@app.get("/health")
async def health():
    return {"status": "healthy"}