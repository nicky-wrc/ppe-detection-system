"""Add settings audit logs.

Revision ID: 20260911_01
Revises: 20260729_01
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision = "20260911_01"
down_revision = "20260729_01"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    if "settings_audit_logs" not in inspector.get_table_names():
        op.create_table(
            "settings_audit_logs",
            sa.Column("id", sa.Integer(), primary_key=True, index=True),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
            sa.Column("changed_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
            sa.Column("old_values", sa.JSON(), nullable=False),
            sa.Column("new_values", sa.JSON(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        )
        op.create_index("ix_settings_audit_logs_user_id", "settings_audit_logs", ["user_id"])
        op.create_index("ix_settings_audit_logs_changed_by", "settings_audit_logs", ["changed_by"])


def downgrade() -> None:
    pass
