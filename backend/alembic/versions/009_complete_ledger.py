"""make the ledger complete: games and adjustments

Every balance change becomes an approved transaction, so a balance always
equals the sum of its user's approved transactions:

- New transaction types 'game' (slot machine spins: win minus bet) and
  'adjustment' (fiscal period resets, admin resets, corrections).
- slot_machine_spins.transaction_id links a spin to its transaction.
- Backfill: a 'game' transaction for every existing spin, and an
  'adjustment' for every past fiscal period reset (one per debt created).
- Whatever the history still can't explain (resets of inactive members,
  "reset all", anything older) gets one 'adjustment' per user, labelled as
  the opening balance correction, so every balance reconciles from now on.

Revision ID: 009_complete_ledger
Revises: 008_add_audit_log
Create Date: 2026-11-08 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "009_complete_ledger"
down_revision: str | None = "008_add_audit_log"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_TYPE_CK_NAMES = ("ck_transactions_ck_transaction_type", "ck_transaction_type")


def _replace_type_check(types: str) -> None:
    for name in _TYPE_CK_NAMES:
        op.execute(f"ALTER TABLE transactions DROP CONSTRAINT IF EXISTS {name}")
    op.create_check_constraint("ck_transaction_type", "transactions", f"type IN ({types})")


def upgrade() -> None:
    _replace_type_check("'purchase', 'payment', 'reward', 'game', 'adjustment'")

    op.add_column("slot_machine_spins", sa.Column("transaction_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        op.f("fk_slot_machine_spins_transaction_id_transactions"),
        "slot_machine_spins",
        "transactions",
        ["transaction_id"],
        ["id"],
    )

    # 1. A 'game' transaction per existing spin. A temporary column carries
    #    the spin id so each spin can be linked to the row created for it.
    op.add_column("transactions", sa.Column("tmp_spin_id", sa.Integer(), nullable=True))
    op.execute(
        """
        INSERT INTO transactions
            (user_id, type, amount, status, quantity, note, created_by_id, created_at, updated_at, tmp_spin_id)
        SELECT user_id, 'game', win_amount - bet_amount, 'approved', 1, 'Slot machine',
               user_id, created_at, created_at, id
        FROM slot_machine_spins
        ORDER BY id
        """
    )
    op.execute(
        """
        UPDATE slot_machine_spins s
        SET transaction_id = t.id
        FROM transactions t
        WHERE t.tmp_spin_id = s.id
        """
    )
    op.drop_column("transactions", "tmp_spin_id")

    # 2. Past fiscal period closes reset each debtor's balance to 0 and moved
    #    the amount to a debt: record that as an adjustment at closing time.
    op.execute(
        """
        INSERT INTO transactions (user_id, type, amount, status, quantity, note, created_at, updated_at)
        SELECT d.user_id, 'adjustment', d.amount, 'approved', 1,
               'Fiscal period closed: ' || d.amount::text || ' € moved to your debts',
               COALESCE(p.ended_at, d.created_at), COALESCE(p.ended_at, d.created_at)
        FROM fiscal_debts d
        JOIN fiscal_periods p ON p.id = d.fiscal_period_id
        ORDER BY d.id
        """
    )

    # 3. One opening correction per user for whatever is still unexplained.
    op.execute(
        """
        INSERT INTO transactions (user_id, type, amount, status, quantity, note, created_at, updated_at)
        SELECT u.id, 'adjustment', u.balance - COALESCE(SUM(t.amount), 0), 'approved', 1,
               'Opening balance: difference found when every balance change started being recorded',
               now(), now()
        FROM users u
        LEFT JOIN transactions t ON t.user_id = u.id AND t.status = 'approved'
        GROUP BY u.id, u.balance
        HAVING u.balance <> COALESCE(SUM(t.amount), 0)
        """
    )


def downgrade() -> None:
    op.drop_constraint(
        op.f("fk_slot_machine_spins_transaction_id_transactions"), "slot_machine_spins", type_="foreignkey"
    )
    op.drop_column("slot_machine_spins", "transaction_id")
    op.execute("DELETE FROM transactions WHERE type IN ('game', 'adjustment')")
    _replace_type_check("'purchase', 'payment', 'reward'")
