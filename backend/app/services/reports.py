"""Admin purchase reports.

All queries are built with SQLAlchemy expressions, so every user-supplied value
(time window, statuses) is sent to the database as a bound parameter, never
interpolated into SQL text.
"""

from dataclasses import dataclass, field
from datetime import UTC, datetime
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.models.product import Product
from app.models.transaction import Transaction
from app.models.user import User
from app.money import ZERO, to_cents
from app.services.profit import COST_COLUMNS, Profit

TRANSACTION_LIST_LIMIT = 500


def to_naive_utc(value: datetime) -> datetime:
    """Timestamps are stored as naive UTC; naive input is treated as UTC."""
    if value.tzinfo is None:
        return value
    return value.astimezone(UTC).replace(tzinfo=None)


@dataclass
class _ProductRow:
    product_id: int | None
    product_name: str | None
    emoji: str | None
    items: int = 0
    amount: Decimal = ZERO
    profit: Profit = field(default_factory=Profit)


@dataclass
class _UserRow:
    user_id: int
    user_name: str | None
    items: int = 0
    amount: Decimal = ZERO
    products: list[_ProductRow] = field(default_factory=list)


@dataclass
class PurchaseReportData:
    total_items: int
    total_amount: Decimal
    by_product: list[_ProductRow]
    by_user: list[_UserRow]
    profit: Profit
    transaction_count: int
    transactions: list[Transaction]


class ReportService:
    @staticmethod
    def _filters(start: datetime, end: datetime, statuses: list[str]):
        return (
            Transaction.type == "purchase",
            Transaction.created_at >= start,
            Transaction.created_at < end,
            Transaction.status.in_(statuses),
        )

    @classmethod
    def purchase_report(cls, db: Session, start: datetime, end: datetime, statuses: list[str]) -> PurchaseReportData:
        start, end = to_naive_utc(start), to_naive_utc(end)
        filters = cls._filters(start, end, statuses)

        # Purchases are stored as negative amounts; report euros spent as positive.
        items_col = func.coalesce(func.sum(Transaction.quantity), 0)
        amount_col = func.coalesce(-func.sum(Transaction.amount), 0)

        grouped = db.execute(
            select(
                Transaction.user_id,
                User.first_name,
                Transaction.product_id,
                Product.name,
                Product.emoji,
                items_col,
                amount_col,
                *COST_COLUMNS,
            )
            .join(User, User.id == Transaction.user_id)
            .outerjoin(Product, Product.id == Transaction.product_id)
            .where(*filters)
            .group_by(
                Transaction.user_id,
                User.first_name,
                Transaction.product_id,
                Product.name,
                Product.emoji,
            )
        ).all()

        products: dict[int | None, _ProductRow] = {}
        users: dict[int, _UserRow] = {}
        total_profit = Profit()
        for user_id, user_name, product_id, product_name, emoji, items, amount, *cost in grouped:
            items, amount = int(items), to_cents(amount)

            prod = products.setdefault(product_id, _ProductRow(product_id, product_name, emoji))
            prod.items += items
            prod.amount += amount
            prod.profit.add(*cost)
            total_profit.add(*cost)

            usr = users.setdefault(user_id, _UserRow(user_id, user_name))
            usr.items += items
            usr.amount += amount
            user_product = _ProductRow(product_id, product_name, emoji, items, amount)
            user_product.profit.add(*cost)
            usr.products.append(user_product)

        by_product = sorted(products.values(), key=lambda p: (-p.items, p.product_name or ""))
        by_user = sorted(users.values(), key=lambda u: (-u.amount, u.user_name or ""))
        for usr in by_user:
            usr.products.sort(key=lambda p: (-p.items, p.product_name or ""))

        transaction_count = db.scalar(select(func.count(Transaction.id)).where(*filters)) or 0

        transactions = list(
            db.scalars(
                select(Transaction)
                .options(
                    joinedload(Transaction.user),
                    joinedload(Transaction.product),
                    joinedload(Transaction.created_by),
                )
                .where(*filters)
                .order_by(Transaction.created_at.desc(), Transaction.id.desc())
                .limit(TRANSACTION_LIST_LIMIT)
            )
        )

        return PurchaseReportData(
            total_items=sum(p.items for p in by_product),
            total_amount=sum((p.amount for p in by_product), ZERO),
            by_product=by_product,
            by_user=by_user,
            profit=total_profit,
            transaction_count=transaction_count,
            transactions=transactions,
        )
