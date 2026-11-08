from pydantic import BaseModel

from app.schemas.common import Money, MoneyIn, UtcDatetime


class PurchaseRequest(BaseModel):
    product_id: int
    quantity: int = 1


class QuantityUpdate(BaseModel):
    quantity: int


class PaymentRequest(BaseModel):
    user_id: int
    amount: MoneyIn
    note: str | None = None


class UserPaymentRequest(BaseModel):
    amount: MoneyIn
    note: str | None = None


class TransactionOut(BaseModel):
    id: int
    user_id: int
    product_id: int | None
    type: str
    amount: Money
    status: str
    approved_by_id: int | None
    created_by_id: int | None = None
    created_by_name: str | None = None
    quantity: int = 1
    note: str | None
    created_at: UtcDatetime
    product_name: str | None = None
    user_name: str | None = None
    # Purchases only: how long the member can still change or cancel it. Sent as
    # a duration rather than a deadline, so a phone with a wrong clock still counts right.
    undo_remaining_ms: int | None = None
    undo_window_ms: int | None = None
    # Approved / rejected by an admin: how long that decision can still be undone.
    decision_remaining_ms: int | None = None
    approved_by_name: str | None = None
    product_emoji: str | None = None

    model_config = {"from_attributes": True}
