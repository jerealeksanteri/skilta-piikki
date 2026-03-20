"""add slot machine

Revision ID: 003_add_slot_machine
Revises: 002_add_rewards
Create Date: 2026-03-14 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "003_add_slot_machine"
down_revision: Union[str, None] = "002_add_rewards"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create slot_machine_spins table
    op.create_table(
        "slot_machine_spins",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("bet_amount", sa.Float(), nullable=False),
        sa.Column("win_amount", sa.Float(), nullable=False),
        sa.Column("symbols", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_slot_machine_spins")),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name=op.f("fk_slot_machine_spins_user_id")),
    )

    # Create indexes for performance
    op.create_index(op.f("ix_slot_machine_spins_user_id"), "slot_machine_spins", ["user_id"])
    op.create_index(op.f("ix_slot_machine_spins_created_at"), "slot_machine_spins", ["created_at"])


def downgrade() -> None:
    op.drop_index(op.f("ix_slot_machine_spins_created_at"), table_name="slot_machine_spins")
    op.drop_index(op.f("ix_slot_machine_spins_user_id"), table_name="slot_machine_spins")
    op.drop_table("slot_machine_spins")
