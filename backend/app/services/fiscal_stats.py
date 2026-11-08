"""Totals for one fiscal period: purchases (with profit), payments and debts."""

from datetime import UTC, datetime

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.fiscal_debt import FiscalDebt
from app.models.fiscal_period import FiscalPeriod
from app.models.transaction import Transaction
from app.money import to_cents
from app.schemas.fiscal import FiscalPeriodStats
from app.services.profit import COST_COLUMNS, Profit


def period_stats(db: Session, period: FiscalPeriod) -> FiscalPeriodStats:
    period_id = period.id

    end = period.ended_at or datetime.now(UTC)

    # Purchase stats
    purchase_stats = (
        db.query(
            func.count(Transaction.id),
            func.coalesce(func.sum(Transaction.amount), 0),
            *COST_COLUMNS,
        )
        .filter(
            Transaction.type == "purchase",
            Transaction.status == "approved",
            Transaction.created_at >= period.started_at,
            Transaction.created_at <= end,
        )
        .first()
    )

    # Payment stats
    payment_stats = (
        db.query(
            func.count(Transaction.id),
            func.coalesce(func.sum(Transaction.amount), 0),
        )
        .filter(
            Transaction.type == "payment",
            Transaction.status == "approved",
            Transaction.created_at >= period.started_at,
            Transaction.created_at <= end,
        )
        .first()
    )

    # Debt stats
    total_debt = (
        db.query(func.coalesce(func.sum(FiscalDebt.amount), 0))
        .filter(FiscalDebt.fiscal_period_id == period_id)
        .scalar()
    )
    debt_collected = (
        db.query(func.coalesce(func.sum(FiscalDebt.amount), 0))
        .filter(FiscalDebt.fiscal_period_id == period_id, FiscalDebt.status == "paid")
        .scalar()
    )

    profit = Profit()
    profit.add(*purchase_stats[2:])

    return FiscalPeriodStats(
        id=period.id,
        started_at=period.started_at,
        ended_at=period.ended_at,
        total_purchases=purchase_stats[0] or 0,
        total_purchase_amount=abs(to_cents(purchase_stats[1] or 0)),
        purchase_cost=profit.fields()["cost"],
        purchase_profit=profit.profit,
        margin_pct=profit.margin_pct,
        cost_missing_items=profit.cost_missing_items,
        total_payments=payment_stats[0] or 0,
        total_payment_amount=to_cents(payment_stats[1] or 0),
        total_debt=to_cents(total_debt or 0),
        debt_collected=to_cents(debt_collected or 0),
        debt_outstanding=to_cents(total_debt or 0) - to_cents(debt_collected or 0),
    )
