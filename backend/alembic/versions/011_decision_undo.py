"""undo window for admin approve / reject

- transactions.decided_until: until when an approve or reject can be undone.
- transactions.notice_pending: the user's Telegram message about the
  decision waits until that window closes, so an undone decision is never
  announced. A scheduler job sends the due ones.

Revision ID: 011_decision_undo
Revises: 010_purchase_undo
Create Date: 2026-11-09 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "011_decision_undo"
down_revision: str | None = "010_purchase_undo"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("transactions", sa.Column("decided_until", sa.DateTime(), nullable=True))
    op.add_column(
        "transactions",
        sa.Column("notice_pending", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    # The sender job looks only at rows still waiting to be announced.
    op.create_index(
        "ix_transactions_notice_due",
        "transactions",
        ["decided_until"],
        postgresql_where=sa.text("notice_pending"),
    )


def downgrade() -> None:
    op.drop_index("ix_transactions_notice_due", table_name="transactions")
    op.drop_column("transactions", "notice_pending")
    op.drop_column("transactions", "decided_until")
