"""reward schedule anchor, idempotent grants, rewards in the ledger

- rewards.schedule_anchor: occurrences are computed from it (no drift,
  month-end safe). Existing recurring rewards are anchored on their current
  next_grant_date.
- reward_grants.scheduled_for + unique (reward_id, user_id, scheduled_for):
  a scheduled occurrence can be paid to a user only once.
- reward_grants.transaction_id and transaction type 'reward': every grant
  is recorded as an approved transaction. Existing grants are backfilled.

Revision ID: 006_reward_schedule_ledger
Revises: 005_add_newsletters
Create Date: 2026-11-08 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "006_reward_schedule_ledger"
down_revision: Union[str, None] = "005_add_newsletters"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# The constraint was created as "ck_transaction_type" through the metadata
# naming convention, which may have expanded it; drop whichever exists.
_OLD_TYPE_CK_NAMES = ("ck_transactions_ck_transaction_type", "ck_transaction_type")


def _replace_type_check(types: str) -> None:
    for name in _OLD_TYPE_CK_NAMES:
        op.execute(f"ALTER TABLE transactions DROP CONSTRAINT IF EXISTS {name}")
    op.create_check_constraint("ck_transaction_type", "transactions", f"type IN ({types})")


def upgrade() -> None:
    op.add_column("rewards", sa.Column("schedule_anchor", sa.DateTime(), nullable=True))
    op.execute(
        "UPDATE rewards SET schedule_anchor = next_grant_date "
        "WHERE reward_type = 'recurring' AND next_grant_date IS NOT NULL"
    )

    op.add_column("reward_grants", sa.Column("scheduled_for", sa.DateTime(), nullable=True))
    op.add_column("reward_grants", sa.Column("transaction_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        op.f("fk_reward_grants_transaction_id_transactions"),
        "reward_grants", "transactions", ["transaction_id"], ["id"],
    )
    op.create_unique_constraint(
        "uq_reward_grants_occurrence",
        "reward_grants",
        ["reward_id", "user_id", "scheduled_for"],
    )

    _replace_type_check("'purchase', 'payment', 'reward'")

    # Backfill: record each existing grant as an approved reward transaction.
    bind = op.get_bind()
    grants = bind.execute(
        sa.text("SELECT id, user_id, amount, reward_name, note, granted_at FROM reward_grants ORDER BY id")
    ).fetchall()
    for g in grants:
        note = f"{g.reward_name} — {g.note}" if g.note else g.reward_name
        tx_id = bind.execute(
            sa.text(
                "INSERT INTO transactions "
                "(user_id, type, amount, status, quantity, note, created_at, updated_at) "
                "VALUES (:user_id, 'reward', :amount, 'approved', 1, :note, :at, :at) "
                "RETURNING id"
            ),
            {"user_id": g.user_id, "amount": g.amount, "note": note, "at": g.granted_at},
        ).scalar_one()
        bind.execute(
            sa.text("UPDATE reward_grants SET transaction_id = :tx WHERE id = :id"),
            {"tx": tx_id, "id": g.id},
        )


def downgrade() -> None:
    op.drop_constraint("uq_reward_grants_occurrence", "reward_grants", type_="unique")
    op.drop_constraint(
        op.f("fk_reward_grants_transaction_id_transactions"), "reward_grants", type_="foreignkey"
    )
    op.drop_column("reward_grants", "transaction_id")
    op.drop_column("reward_grants", "scheduled_for")
    op.drop_column("rewards", "schedule_anchor")

    op.execute("DELETE FROM transactions WHERE type = 'reward'")
    _replace_type_check("'purchase', 'payment'")
