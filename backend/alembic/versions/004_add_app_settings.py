"""add app settings

Revision ID: 004_add_app_settings
Revises: 003_add_slot_machine
Create Date: 2026-03-29 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "004_add_app_settings"
down_revision: Union[str, None] = "003_add_slot_machine"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "app_settings",
        sa.Column("key", sa.String(), nullable=False),
        sa.Column("value", sa.String(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("key", name=op.f("pk_app_settings")),
    )

    # Seed default: slot machine enabled
    op.execute(
        "INSERT INTO app_settings (key, value, updated_at) VALUES ('slot_machine_enabled', 'true', now())"
    )


def downgrade() -> None:
    op.drop_table("app_settings")
