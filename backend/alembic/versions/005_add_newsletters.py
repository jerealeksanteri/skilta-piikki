"""add newsletters

Revision ID: 005_add_newsletters
Revises: 004_add_app_settings
Create Date: 2026-11-06 00:00:00.000000

"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "005_add_newsletters"
down_revision: Union[str, None] = "004_add_app_settings"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "newsletters",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("created_by_id", sa.Integer(), nullable=False),
        sa.Column("audience", sa.String(), nullable=False),
        sa.Column("markup", sa.Text(), nullable=False),
        sa.Column("html", sa.Text(), nullable=False),
        sa.Column("recipient_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("delivered_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("failed_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.CheckConstraint("audience IN ('everyone', 'admins')", name="ck_newsletter_audience"),
        sa.ForeignKeyConstraint(
            ["created_by_id"],
            ["users.id"],
            name=op.f("fk_newsletters_created_by_id_users"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_newsletters")),
    )
    op.create_index(op.f("ix_newsletters_created_at"), "newsletters", ["created_at"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_newsletters_created_at"), table_name="newsletters")
    op.drop_table("newsletters")
