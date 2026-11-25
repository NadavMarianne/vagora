"""poker table skin: how a table looks

Revision ID: 7a3c1e9b2d40
Revises: 5149905ecf2f
Create Date: 2026-11-15 12:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "7a3c1e9b2d40"
down_revision: str | None = "5149905ecf2f"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "poker_tables",
        sa.Column("skin", sa.String(length=20), server_default="green", nullable=False),
    )


def downgrade() -> None:
    op.drop_column("poker_tables", "skin")
