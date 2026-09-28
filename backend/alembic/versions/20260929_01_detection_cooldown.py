"""Add per-user detection cooldown.

Revision ID: 20260929_01
Revises: 20260911_01
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision = "20260929_01"
down_revision = "20260911_01"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    columns = {column["name"] for column in inspect(bind).get_columns("user_settings")}
    if "detection_cooldown_seconds" not in columns:
        op.add_column(
            "user_settings",
            sa.Column("detection_cooldown_seconds", sa.Integer(), nullable=False, server_default="30"),
        )


def downgrade() -> None:
    bind = op.get_bind()
    columns = {column["name"] for column in inspect(bind).get_columns("user_settings")}
    if "detection_cooldown_seconds" in columns:
        op.drop_column("user_settings", "detection_cooldown_seconds")
