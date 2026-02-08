"""add user management and payment tracking

Revision ID: 346337283be3
Revises: 11e98b112a30
Create Date: 2026-02-08 16:36:00.171378

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '346337283be3'
down_revision: Union[str, Sequence[str], None] = '11e98b112a30'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table(
        'transactions',
        schema=None,
        table_args=[
            sa.CheckConstraint("type IN ('purchase', 'payment')", name='ck_transaction_type'),
            sa.CheckConstraint("status IN ('pending', 'approved', 'rejected')", name='ck_transaction_status'),
        ],
    ) as batch_op:
        batch_op.add_column(sa.Column('created_by_id', sa.Integer(), nullable=True))
        batch_op.create_foreign_key('fk_transactions_created_by_id_users', 'users', ['created_by_id'], ['id'])

    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.add_column(sa.Column('is_active', sa.Boolean(), server_default='1', nullable=False))
        batch_op.add_column(sa.Column('added_by_id', sa.Integer(), nullable=True))
        batch_op.create_foreign_key('fk_users_added_by_id_users', 'users', ['added_by_id'], ['id'])


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_constraint('fk_users_added_by_id_users', type_='foreignkey')
        batch_op.drop_column('added_by_id')
        batch_op.drop_column('is_active')

    with op.batch_alter_table(
        'transactions',
        schema=None,
        table_args=[
            sa.CheckConstraint("type IN ('purchase', 'payment')", name='ck_transaction_type'),
            sa.CheckConstraint("status IN ('pending', 'approved', 'rejected')", name='ck_transaction_status'),
        ],
    ) as batch_op:
        batch_op.drop_constraint('fk_transactions_created_by_id_users', type_='foreignkey')
        batch_op.drop_column('created_by_id')
