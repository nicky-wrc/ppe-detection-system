import asyncio
import logging
from datetime import datetime, timedelta, timezone
from pathlib import Path

from app.core.config import settings
from app.core.database import SessionLocal
from app.models import Detection, ViolationLog

logger = logging.getLogger(__name__)


def _safe_unlink(path_value: str | None, root: Path | None = None) -> bool:
    if not path_value:
        return False
    allowed_root = (root or Path(settings.EVIDENCE_DIR)).resolve()
    path = Path(path_value).resolve()
    try:
        path.relative_to(allowed_root)
    except ValueError:
        logger.warning("Refusing to delete evidence outside configured root: %s", path)
        return False
    path.unlink(missing_ok=True)
    return True


def purge_expired_evidence() -> int:
    cutoff = datetime.now(timezone.utc) - timedelta(days=settings.EVIDENCE_RETENTION_DAYS)
    db = SessionLocal()
    removed = 0
    try:
        events = db.query(ViolationLog).filter(ViolationLog.created_at < cutoff).all()
        for event in events:
            if _safe_unlink(event.snapshot_path):
                removed += 1
            if _safe_unlink(event.evidence_clip_path):
                removed += 1
            event.snapshot_path = None
            event.evidence_clip_path = None

        uploads_root = Path(settings.UPLOAD_DIR).resolve()
        detections = db.query(Detection).filter(Detection.created_at < cutoff).all()
        for detection in detections:
            if _safe_unlink(detection.original_image_path, uploads_root):
                detection.original_image_path = "expired"
                removed += 1
            if _safe_unlink(detection.result_image_path, uploads_root):
                detection.result_image_path = None
                removed += 1
            if _safe_unlink(detection.result_video_path, uploads_root):
                detection.result_video_path = None
                removed += 1
        db.commit()
        return removed
    finally:
        db.close()


async def retention_loop() -> None:
    while True:
        try:
            removed = await asyncio.to_thread(purge_expired_evidence)
            if removed:
                logger.info("Removed %s expired evidence files", removed)
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("Evidence retention cleanup failed")
        await asyncio.sleep(24 * 60 * 60)
