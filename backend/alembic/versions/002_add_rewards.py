"""add rewards system

Revision ID: 002_add_rewards
Revises: 001_initial_pg
Create Date: 2026-03-01 12:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "002_add_rewards"
down_revision: Union[str, None] = "001_initial_pg"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create rewards table
    op.create_table(
        "rewards",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("amount", sa.Float(), nullable=False),
        sa.Column("reward_type", sa.String(), nullable=False),
        sa.Column("recurrence_frequency", sa.String(), nullable=True),
        sa.Column("next_grant_date", sa.DateTime(), nullable=True),
        sa.Column("assigned_user_ids", sa.Text(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_by_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_rewards")),
        sa.CheckConstraint(
            "reward_type IN ('one_time', 'recurring')",
            name="ck_reward_type",
        ),
        sa.CheckConstraint(
            "recurrence_frequency IS NULL OR recurrence_frequency IN ('daily', 'weekly', 'monthly', 'yearly')",
            name="ck_recurrence_frequency",
        ),
    )

    # Create reward_grants table
    op.create_table(
        "reward_grants",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("reward_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("reward_name", sa.String(), nullable=False),
        sa.Column("amount", sa.Float(), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("granted_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.Column("granted_by_scheduler", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_reward_grants")),
        sa.ForeignKeyConstraint(["reward_id"], ["rewards.id"], name=op.f("fk_reward_grants_reward_id")),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name=op.f("fk_reward_grants_user_id")),
    )

    # Create indexes for performance
    op.create_index(op.f("ix_reward_grants_user_id"), "reward_grants", ["user_id"])
    op.create_index(op.f("ix_reward_grants_reward_id"), "reward_grants", ["reward_id"])
    op.create_index(op.f("ix_reward_grants_granted_at"), "reward_grants", ["granted_at"])
    op.create_index(op.f("ix_rewards_next_grant_date"), "rewards", ["next_grant_date"])


def downgrade() -> None:
    op.drop_index(op.f("ix_rewards_next_grant_date"), table_name="rewards")
    op.drop_index(op.f("ix_reward_grants_granted_at"), table_name="reward_grants")
    op.drop_index(op.f("ix_reward_grants_reward_id"), table_name="reward_grants")
    op.drop_index(op.f("ix_reward_grants_user_id"), table_name="reward_grants")
    op.drop_table("reward_grants")
    op.drop_table("rewards")
