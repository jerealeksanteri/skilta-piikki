from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.auth.telegram import require_active_user, require_admin
from app.database import get_db
from app.models.fiscal_debt import FiscalDebt
from app.models.fiscal_period import FiscalPeriod
from app.models.transaction import Transaction
from app.models.user import User
from app.schemas.fiscal import CloseResult, FiscalDebtOut, FiscalPeriodOut, FiscalPeriodStats
from app.services.messaging import send_bulk_event_message

router = APIRouter()


def _debt_to_out(debt: FiscalDebt) -> FiscalDebtOut:
    return FiscalDebtOut(
        id=debt.id,
        fiscal_period_id=debt.fiscal_period_id,
        user_id=debt.user_id,
        user_name=debt.user.first_name if debt.user else None,
        amount=debt.amount,
        status=debt.status,
        paid_at=debt.paid_at,
        created_at=debt.created_at,
        period_started_at=debt.fiscal_period.started_at if debt.fiscal_period else None,
        period_ended_at=debt.fiscal_period.ended_at if debt.fiscal_period else None,
    )


@router.get("/fiscal-periods", response_model=list[FiscalPeriodOut])
def list_fiscal_periods(
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return (
        db.query(FiscalPeriod)
        .order_by(FiscalPeriod.started_at.desc())
        .all()
    )


@router.get("/fiscal-periods/current", response_model=FiscalPeriodOut)
def get_current_period(
    _user: User = Depends(require_active_user),
    db: Session = Depends(get_db),
):
    period = db.query(FiscalPeriod).filter(FiscalPeriod.ended_at.is_(None)).first()
    if not period:
        raise HTTPException(status_code=404, detail="No active fiscal period")
    return period


@router.post("/fiscal-periods/close", response_model=CloseResult)
def close_fiscal_period(
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    current = db.query(FiscalPeriod).filter(FiscalPeriod.ended_at.is_(None)).first()
    if not current:
        raise HTTPException(status_code=400, detail="No active fiscal period to close")

    now = datetime.now(timezone.utc)
    current.ended_at = now

    # Create debts for users with negative balance
    debtors = (
        db.query(User)
        .filter(User.is_active == True, User.balance < 0)  # noqa: E712
        .all()
    )
    debts_created = 0
    users_and_vars: list[tuple[User, dict]] = []
    for user in debtors:
        debt = FiscalDebt(
            fiscal_period_id=current.id,
            user_id=user.id,
            amount=abs(user.balance),
            status="unpaid",
        )
        db.add(debt)
        debts_created += 1
        users_and_vars.append((user, {
            "user": user.first_name,
            "amount": f"{abs(user.balance):.2f}",
        }))

    # Reset ALL user balances to 0
    db.query(User).update({User.balance: 0.0})

    # Create new fiscal period
    new_period = FiscalPeriod(started_at=now)
    db.add(new_period)
    db.commit()
    db.refresh(new_period)

    # Send messages to debtors
    if users_and_vars:
        send_bulk_event_message(db, "fiscal_period_closed", users_and_vars)

    return CloseResult(
        closed_period_id=current.id,
        debts_created=debts_created,
        new_period_id=new_period.id,
    )


@router.get("/fiscal-periods/{period_id}/stats", response_model=FiscalPeriodStats)
def get_period_stats(
    period_id: int,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    period = db.query(FiscalPeriod).filter(FiscalPeriod.id == period_id).first()
    if not period:
        raise HTTPException(status_code=404, detail="Period not found")

    end = period.ended_at or datetime.now(timezone.utc)

    # Purchase stats
    purchase_stats = (
        db.query(
            func.count(Transaction.id),
            func.coalesce(func.sum(Transaction.amount), 0.0),
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
            func.coalesce(func.sum(Transaction.amount), 0.0),
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
        db.query(func.coalesce(func.sum(FiscalDebt.amount), 0.0))
        .filter(FiscalDebt.fiscal_period_id == period_id)
        .scalar()
    )
    debt_collected = (
        db.query(func.coalesce(func.sum(FiscalDebt.amount), 0.0))
        .filter(FiscalDebt.fiscal_period_id == period_id, FiscalDebt.status == "paid")
        .scalar()
    )

    return FiscalPeriodStats(
        id=period.id,
        started_at=period.started_at,
        ended_at=period.ended_at,
        total_purchases=purchase_stats[0] or 0,
        total_purchase_amount=abs(float(purchase_stats[1] or 0)),
        total_payments=payment_stats[0] or 0,
        total_payment_amount=float(payment_stats[1] or 0),
        total_debt=float(total_debt or 0),
        debt_collected=float(debt_collected or 0),
        debt_outstanding=float(total_debt or 0) - float(debt_collected or 0),
    )


@router.get("/fiscal-periods/{period_id}/debts", response_model=list[FiscalDebtOut])
def get_period_debts(
    period_id: int,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    debts = (
        db.query(FiscalDebt)
        .filter(FiscalDebt.fiscal_period_id == period_id)
        .order_by(FiscalDebt.amount.desc())
        .all()
    )
    return [_debt_to_out(d) for d in debts]


@router.get("/fiscal-debts/pending", response_model=list[FiscalDebtOut])
def get_all_pending_debts(
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Get all pending debt payments across all fiscal periods."""
    debts = (
        db.query(FiscalDebt)
        .filter(FiscalDebt.status == "payment_pending")
        .order_by(FiscalDebt.created_at.desc())
        .all()
    )
    return [_debt_to_out(d) for d in debts]


@router.get("/my/debts", response_model=list[FiscalDebtOut])
def get_my_debts(
    user: User = Depends(require_active_user),
    db: Session = Depends(get_db),
):
    debts = (
        db.query(FiscalDebt)
        .filter(
            FiscalDebt.user_id == user.id,
            FiscalDebt.status.in_(["unpaid", "payment_pending"]),
        )
        .order_by(FiscalDebt.created_at.desc())
        .all()
    )
    return [_debt_to_out(d) for d in debts]


@router.post("/fiscal-debts/{debt_id}/request-payment", response_model=FiscalDebtOut)
def request_debt_payment(
    debt_id: int,
    user: User = Depends(require_active_user),
    db: Session = Depends(get_db),
):
    debt = db.query(FiscalDebt).filter(FiscalDebt.id == debt_id).first()
    if not debt:
        raise HTTPException(status_code=404, detail="Debt not found")
    if debt.user_id != user.id:
        raise HTTPException(status_code=403, detail="Not your debt")
    if debt.status != "unpaid":
        raise HTTPException(status_code=400, detail="Debt is not in unpaid status")

    debt.status = "payment_pending"
    db.commit()
    db.refresh(debt)
    return _debt_to_out(debt)


@router.put("/fiscal-debts/{debt_id}/approve", response_model=FiscalDebtOut)
def approve_debt_payment(
    debt_id: int,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    debt = db.query(FiscalDebt).filter(FiscalDebt.id == debt_id).first()
    if not debt:
        raise HTTPException(status_code=404, detail="Debt not found")
    if debt.status != "payment_pending":
        raise HTTPException(status_code=400, detail="Debt payment is not pending")

    debt.status = "paid"
    debt.paid_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(debt)

    from app.services.messaging import send_event_message
    send_event_message(db, "debt_payment_approved", debt.user, {
        "user": debt.user.first_name,
        "amount": f"{debt.amount:.2f}",
    })

    return _debt_to_out(debt)


@router.put("/fiscal-debts/{debt_id}/reject", response_model=FiscalDebtOut)
def reject_debt_payment(
    debt_id: int,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    debt = db.query(FiscalDebt).filter(FiscalDebt.id == debt_id).first()
    if not debt:
        raise HTTPException(status_code=404, detail="Debt not found")
    if debt.status != "payment_pending":
        raise HTTPException(status_code=400, detail="Debt payment is not pending")

    debt.status = "unpaid"
    db.commit()
    db.refresh(debt)

    from app.services.messaging import send_event_message
    send_event_message(db, "debt_payment_rejected", debt.user, {
        "user": debt.user.first_name,
        "amount": f"{debt.amount:.2f}",
    })

    return _debt_to_out(debt)


@router.put("/fiscal-debts/{debt_id}/mark-paid", response_model=FiscalDebtOut)
def mark_debt_paid(
    debt_id: int,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    debt = db.query(FiscalDebt).filter(FiscalDebt.id == debt_id).first()
    if not debt:
        raise HTTPException(status_code=404, detail="Debt not found")
    if debt.status == "paid":
        raise HTTPException(status_code=400, detail="Debt is already paid")

    debt.status = "paid"
    debt.paid_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(debt)

    from app.services.messaging import send_event_message
    send_event_message(db, "debt_payment_approved", debt.user, {
        "user": debt.user.first_name,
        "amount": f"{debt.amount:.2f}",
    })

    return _debt_to_out(debt)
