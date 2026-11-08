"""undo window for purchases

- transactions.undo_until: until when the member may still change the
  quantity of a purchase or cancel it.
- New transaction status 'cancelled' for purchases undone in that window.
  Their balance change is reversed, so like rejected ones they stay out of
  the ledger, reports and fiscal summaries.

Revision ID: 010_purchase_undo
Revises: 009_complete_ledger
Create Date: 2026-11-09 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "010_purchase_undo"
down_revision: str | None = "009_complete_ledger"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_STATUS_CK_NAMES = ("ck_transactions_ck_transaction_status", "ck_transaction_status")


def _replace_status_check(statuses: str) -> None:
    for name in _STATUS_CK_NAMES:
        op.execute(f"ALTER TABLE transactions DROP CONSTRAINT IF EXISTS {name}")
    op.create_check_constraint("ck_transaction_status", "transactions", f"status IN ({statuses})")


def upgrade() -> None:
    op.add_column("transactions", sa.Column("undo_until", sa.DateTime(), nullable=True))
    _replace_status_check("'pending', 'approved', 'rejected', 'cancelled'")


def downgrade() -> None:
    # A cancelled purchase has no balance effect, which is what 'rejected' means too.
    op.execute("UPDATE transactions SET status = 'rejected' WHERE status = 'cancelled'")
    _replace_status_check("'pending', 'approved', 'rejected'")
    op.drop_column("transactions", "undo_until")
