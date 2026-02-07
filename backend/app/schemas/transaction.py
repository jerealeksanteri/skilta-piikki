from datetime import datetime

from pydantic import BaseModel


class PurchaseRequest(BaseModel):
    product_id: int


class PaymentRequest(BaseModel):
    user_id: int
    amount: float
    note: str | None = None


class TransactionOut(BaseModel):
    id: int
    user_id: int
    product_id: int | None
    type: str
    amount: float
    status: str
    approved_by_id: int | None
    note: str | None
    created_at: datetime
    product_name: str | None = None
    user_name: str | None = None

    model_config = {"from_attributes": True}
