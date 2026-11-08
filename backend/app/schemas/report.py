from pydantic import BaseModel

from app.schemas.common import Money, UtcDatetime
from app.schemas.transaction import TransactionOut


class ProductSummary(BaseModel):
    product_id: int | None
    product_name: str | None
    emoji: str | None
    items: int
    amount: Money


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
    user_count: int
    by_product: list[ProductSummary]
    by_user: list[UserSummary]
    transaction_count: int
    transactions_truncated: bool
    transactions: list[TransactionOut]
