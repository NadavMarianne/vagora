"""ledger other side: who coins sent between members went to or came from

Revision ID: 3f8d2a6c91be
Revises: 7a3c1e9b2d40
Create Date: 2026-11-27 12:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "3f8d2a6c91be"
down_revision: str | None = "7a3c1e9b2d40"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("ledger_entries", sa.Column("other_membership_id", sa.Integer(), nullable=True))
    # Named like PostgreSQL's automatic names, so downgrade can find it.
    op.create_foreign_key(
        "ledger_entries_other_membership_id_fkey",
        "ledger_entries",
        "memberships",
        ["other_membership_id"],
        ["id"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "ledger_entries_other_membership_id_fkey", "ledger_entries", type_="foreignkey"
    )
    op.drop_column("ledger_entries", "other_membership_id")
