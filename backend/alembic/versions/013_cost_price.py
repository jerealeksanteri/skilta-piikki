"""cost price for products and on each purchase

- products.cost_price: what one unit costs the guild (optional).
- transactions.unit_cost: the cost price when the purchase was made, so a
  later cost change doesn't rewrite past profit. Existing purchases keep
  NULL: their cost isn't known, and reports show them as "cost missing".

Revision ID: 013_cost_price
Revises: 012_user_favourites
Create Date: 2026-11-09 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "013_cost_price"
down_revision: str | None = "012_user_favourites"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("products", sa.Column("cost_price", sa.Numeric(10, 2), nullable=True))
    op.add_column("transactions", sa.Column("unit_cost", sa.Numeric(10, 2), nullable=True))


def downgrade() -> None:
    op.drop_column("transactions", "unit_cost")
    op.drop_column("products", "cost_price")
