from pydantic import BaseModel

from app.schemas.common import Money, UtcDatetime
from app.schemas.transaction import TransactionOut


class ProductSummary(BaseModel):
    product_id: int | None
    product_name: str | None
    emoji: str | None
    items: int
    amount: Money
    # Profit on the purchases with a known cost price; None when none had one.
    cost: Money | None = None
    profit: Money | None = None
    margin_pct: float | None = None
    cost_missing_items: int = 0


class UserSummary(BaseModel):
    user_id: int
    user_name: str | None
    items: int
    amount: Money
    products: list[ProductSummary]


class PurchaseReport(BaseModel):
    start: UtcDatetime
    end: UtcDatetime
    statuses: list[str]
    total_items: int
    total_amount: Money
    total_cost: Money | None = None
    total_profit: Money | None = None
    margin_pct: float | None = None
    cost_missing_items: int = 0
    user_count: int
    by_product: list[ProductSummary]
    by_user: list[UserSummary]
    transaction_count: int
    transactions_truncated: bool
    transactions: list[TransactionOut]
