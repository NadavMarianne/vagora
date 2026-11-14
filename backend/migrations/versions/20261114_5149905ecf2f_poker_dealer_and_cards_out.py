"""poker dealer and cards out: who dealt a hand, and whether its round waits for the cards

Revision ID: 5149905ecf2f
Revises: c44ee388eade
Create Date: 2026-11-14 18:37:18.865011
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "5149905ecf2f"
down_revision: str | None = "c44ee388eade"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("poker_hands", sa.Column("dealer_id", sa.Integer(), nullable=True))
    op.add_column(
        "poker_hands",
        sa.Column(
            "waiting_for_cards", sa.Boolean(), server_default=sa.text("false"), nullable=False
        ),
    )
    op.create_foreign_key(
        "poker_hands_dealer_id_fkey", "poker_hands", "users", ["dealer_id"], ["id"]
    )


def downgrade() -> None:
    op.drop_constraint("poker_hands_dealer_id_fkey", "poker_hands", type_="foreignkey")
    op.drop_column("poker_hands", "waiting_for_cards")
    op.drop_column("poker_hands", "dealer_id")
