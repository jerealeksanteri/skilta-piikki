from pydantic import BaseModel

from app.schemas.common import UtcDatetime


class FiscalPeriodOut(BaseModel):
    id: int
    started_at: UtcDatetime
    ended_at: UtcDatetime | None
    created_at: UtcDatetime

    model_config = {"from_attributes": True}


class FiscalPeriodStats(BaseModel):
    id: int
    started_at: UtcDatetime
    ended_at: UtcDatetime | None
    total_purchases: int
    total_purchase_amount: float
    total_payments: int
    total_payment_amount: float
    total_debt: float
    debt_collected: float
    debt_outstanding: float


class FiscalDebtOut(BaseModel):
    id: int
    fiscal_period_id: int
    user_id: int
    user_name: str | None = None
    amount: float
    status: str
    paid_at: UtcDatetime | None
    created_at: UtcDatetime
    period_started_at: UtcDatetime | None = None
    period_ended_at: UtcDatetime | None = None

    model_config = {"from_attributes": True}


class CloseResult(BaseModel):
    closed_period_id: int
    debts_created: int
    new_period_id: int
