from pydantic import BaseModel

from app.schemas.common import Money, UtcDatetime


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
    total_purchase_amount: Money
    # Profit on the period's purchases with a known cost price (see services/profit.py).
    purchase_cost: Money | None = None
    purchase_profit: Money | None = None
    margin_pct: float | None = None
    cost_missing_items: int = 0
    total_payments: int
    total_payment_amount: Money
    total_debt: Money
    debt_collected: Money
    debt_outstanding: Money


class FiscalDebtOut(BaseModel):
    id: int
    fiscal_period_id: int
    user_id: int
    user_name: str | None = None
    amount: Money
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
