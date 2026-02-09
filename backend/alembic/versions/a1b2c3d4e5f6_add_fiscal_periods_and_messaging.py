"""add fiscal periods, debts, message templates, and quantity to transactions

Revision ID: a1b2c3d4e5f6
Revises: 346337283be3
Create Date: 2026-02-09 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, None] = "346337283be3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "fiscal_periods",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("started_at", sa.DateTime(), nullable=False),
        sa.Column("ended_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_fiscal_periods")),
    )

    op.create_table(
        "fiscal_debts",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("fiscal_period_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("amount", sa.Float(), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("paid_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_fiscal_debts")),
        sa.ForeignKeyConstraint(
            ["fiscal_period_id"],
            ["fiscal_periods.id"],
            name=op.f("fk_fiscal_debts_fiscal_period_id_fiscal_periods"),
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name=op.f("fk_fiscal_debts_user_id_users"),
        ),
        sa.CheckConstraint(
            "status IN ('unpaid', 'payment_pending', 'paid')",
            name=op.f("ck_fiscal_debts_ck_fiscal_debt_status"),
        ),
    )

    op.create_table(
        "message_templates",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("event_type", sa.String(), nullable=False),
        sa.Column("template", sa.String(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_message_templates")),
        sa.UniqueConstraint("event_type", name=op.f("uq_message_templates_event_type")),
    )

    with op.batch_alter_table("transactions") as batch_op:
        batch_op.add_column(
            sa.Column("quantity", sa.Integer(), nullable=False, server_default="1")
        )


def downgrade() -> None:
    with op.batch_alter_table("transactions") as batch_op:
        batch_op.drop_column("quantity")

    op.drop_table("message_templates")
    op.drop_table("fiscal_debts")
    op.drop_table("fiscal_periods")
