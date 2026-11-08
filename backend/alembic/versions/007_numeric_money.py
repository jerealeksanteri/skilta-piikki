"""store money as NUMERIC(10, 2) instead of float

Every money column moves from double precision to NUMERIC(10, 2): balances,
transaction / reward / grant / debt amounts, product prices and slot
machine bets and wins. Existing values are rounded to the cent, which also
cleans up float drift such as 2.9999999999 -> 3.00.

Revision ID: 007_numeric_money
Revises: 006_reward_schedule_ledger
Create Date: 2026-11-08 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "007_numeric_money"
down_revision: str | None = "006_reward_schedule_ledger"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

MONEY_COLUMNS = [
    ("users", "balance"),
    ("transactions", "amount"),
    ("products", "price"),
    ("rewards", "amount"),
    ("reward_grants", "amount"),
    ("fiscal_debts", "amount"),
    ("slot_machine_spins", "bet_amount"),
    ("slot_machine_spins", "win_amount"),
]


def upgrade() -> None:
    for table, column in MONEY_COLUMNS:
        op.alter_column(
            table,
            column,
            type_=sa.Numeric(10, 2),
            existing_type=sa.Float(),
            postgresql_using=f"round({column}::numeric, 2)",
        )
    op.alter_column("users", "balance", server_default=sa.text("0"), existing_type=sa.Numeric(10, 2))


def downgrade() -> None:
    op.alter_column("users", "balance", server_default=sa.text("0.0"), existing_type=sa.Numeric(10, 2))
    for table, column in MONEY_COLUMNS:
        op.alter_column(
            table,
            column,
            type_=sa.Float(),
            existing_type=sa.Numeric(10, 2),
            postgresql_using=f"{column}::double precision",
        )
