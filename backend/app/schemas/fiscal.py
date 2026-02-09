from datetime import datetime

from pydantic import BaseModel


class FiscalPeriodOut(BaseModel):
    id: int
    started_at: datetime
    ended_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class FiscalPeriodStats(BaseModel):
    id: int
    started_at: datetime
    ended_at: datetime | None
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
    paid_at: datetime | None
    created_at: datetime
    period_started_at: datetime | None = None
    period_ended_at: datetime | None = None

    model_config = {"from_attributes": True}


class CloseResult(BaseModel):
    closed_period_id: int
    debts_created: int
    new_period_id: int
