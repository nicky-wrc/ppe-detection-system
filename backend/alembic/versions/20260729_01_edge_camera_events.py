"""Baseline existing schema and add edge camera event fields.

Revision ID: 20260729_01
Revises:
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

from app.core.database import Base
import app.models  # noqa: F401

revision = "20260729_01"
down_revision = None
branch_labels = None
depends_on = None


def _add_missing(table: str, columns: list[sa.Column]) -> None:
    bind = op.get_bind()
    existing = {column["name"] for column in inspect(bind).get_columns(table)}
    for column in columns:
        if column.name not in existing:
            op.add_column(table, column)


def upgrade() -> None:
    bind = op.get_bind()
    Base.metadata.create_all(bind=bind)

    _add_missing(
        "cameras",
        [
            sa.Column("owner_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
            sa.Column("source_type", sa.String(20), nullable=False, server_default="usb"),
            sa.Column("device_index", sa.Integer(), nullable=True),
            sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("last_error", sa.Text(), nullable=True),
            sa.Column("measured_fps", sa.Float(), nullable=True, server_default="0"),
            sa.Column("frames_analyzed", sa.Integer(), nullable=True, server_default="0"),
        ],
    )
    _add_missing(
        "violation_logs",
        [
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
            sa.Column("track_id", sa.Integer(), nullable=True),
            sa.Column("evidence_clip_path", sa.String(500), nullable=True),
            sa.Column("model_version", sa.String(100), nullable=True),
            sa.Column("resolved_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
            sa.Column("first_seen", sa.DateTime(timezone=True), nullable=True),
            sa.Column("last_seen", sa.DateTime(timezone=True), nullable=True),
        ],
    )
    _add_missing(
        "alerts",
        [sa.Column("violation_log_id", sa.Integer(), sa.ForeignKey("violation_logs.id"), nullable=True)],
    )
    _add_missing(
        "detections",
        [sa.Column("result_video_path", sa.String(500), nullable=True)],
    )


def downgrade() -> None:
    # This is a baseline migration for existing installations. Downgrade is
    # intentionally non-destructive so event evidence and audit data are kept.
    pass
