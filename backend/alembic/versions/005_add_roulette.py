"""add roulette

Revision ID: 005_add_roulette
Revises: 004_add_app_settings
Create Date: 2026-03-31 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "005_add_roulette"
down_revision: Union[str, None] = "004_add_app_settings"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "roulette_spins",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("bet_amount", sa.Float(), nullable=False),
        sa.Column("win_amount", sa.Float(), nullable=False),
        sa.Column("bet_data", sa.String(), nullable=False),
        sa.Column("result_number", sa.Integer(), nullable=False),
        sa.Column("result_color", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_roulette_spins")),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name=op.f("fk_roulette_spins_user_id")),
    )

    op.create_index(op.f("ix_roulette_spins_user_id"), "roulette_spins", ["user_id"])
    op.create_index(op.f("ix_roulette_spins_created_at"), "roulette_spins", ["created_at"])


def downgrade() -> None:
    op.drop_index(op.f("ix_roulette_spins_created_at"), table_name="roulette_spins")
    op.drop_index(op.f("ix_roulette_spins_user_id"), table_name="roulette_spins")
    op.drop_table("roulette_spins")
