"""allowance recipients and dates: who gets an allowance, and the days it's valid

Revision ID: 8b1e4c7d2f90
Revises: 3f8d2a6c91be
Create Date: 2026-11-27 18:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "8b1e4c7d2f90"
down_revision: str | None = "3f8d2a6c91be"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "allowances",
        sa.Column("recipients", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )
    op.add_column("allowances", sa.Column("starts_on", sa.Date(), nullable=True))
    op.add_column("allowances", sa.Column("ends_on", sa.Date(), nullable=True))


def downgrade() -> None:
    op.drop_column("allowances", "ends_on")
    op.drop_column("allowances", "starts_on")
    op.drop_column("allowances", "recipients")
