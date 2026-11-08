"""Purchases and their undo window.

A tapped drink is recorded (and, with auto-approve, charged) at once, so it
survives the member closing the app. For UNDO_WINDOW_SECONDS afterwards the
member can change its quantity or cancel it, or settle it to close the window
early; tapping the same drink again inside the window adds to that purchase
and restarts the window. The server's
clock decides, with a few seconds' grace for slow networks. A cancelled
purchase gets status 'cancelled' and its balance change is reversed, so it
counts nowhere: ledger, reports and fiscal summaries all read approved rows.
"""

from datetime import datetime, timedelta
from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.models.product import Product
from app.models.transaction import Transaction
from app.models.user import User
from app.services.balance import adjust_balance
from app.services.reward_schedule import utcnow

GRACE = timedelta(seconds=5)
OPEN_STATUSES = ("pending", "approved")
MAX_QUANTITY = 99


def now() -> datetime:
    """Current naive UTC time; tests replace this to move the clock."""
    return utcnow()


def window() -> timedelta:
    return timedelta(seconds=settings.UNDO_WINDOW_SECONDS)


def remaining_ms(tx: Transaction) -> int | None:
    """Milliseconds left to change the purchase, or None once it can't be changed."""
    if tx.type != "purchase" or tx.undo_until is None or tx.status not in OPEN_STATUSES:
        return None
    left = (tx.undo_until - now()).total_seconds()
    return int(left * 1000) if left > 0 else None


def _set_quantity(db: Session, tx: Transaction, quantity: int) -> None:
    if not 1 <= quantity <= MAX_QUANTITY:
        raise HTTPException(status_code=400, detail=f"Quantity must be between 1 and {MAX_QUANTITY}")
    # The price the purchase was made at, so a price change meanwhile doesn't leak in.
    unit_price = -tx.amount / tx.quantity
    new_amount = -(unit_price * quantity)
    if tx.status == "approved":
        adjust_balance(db, tx.user, new_amount - tx.amount)
    tx.quantity = quantity
    tx.amount = new_amount


class PurchaseService:
    @staticmethod
    def create(db: Session, user: User, product: Product, quantity: int) -> Transaction:
        # One purchase at a time per member, so two quick taps of the same drink
        # add up in one row instead of both creating a new one.
        db.execute(select(User.id).where(User.id == user.id).with_for_update())
        current = now()
        existing = (
            db.query(Transaction)
            .filter(
                Transaction.user_id == user.id,
                Transaction.product_id == product.id,
                Transaction.type == "purchase",
                Transaction.status.in_(OPEN_STATUSES),
                Transaction.undo_until > current,
            )
            .order_by(Transaction.id.desc())
            .with_for_update()
            .first()
        )
        if existing:
            _set_quantity(db, existing, existing.quantity + quantity)
            existing.undo_until = current + window()
            return existing

        if not 1 <= quantity <= MAX_QUANTITY:
            raise HTTPException(status_code=400, detail=f"Quantity must be between 1 and {MAX_QUANTITY}")
        auto_approve = settings.AUTO_APPROVE_PURCHASES
        tx = Transaction(
            user_id=user.id,
            product_id=product.id,
            type="purchase",
            amount=-(Decimal(product.price) * quantity),
            quantity=quantity,
            status="approved" if auto_approve else "pending",
            created_by_id=user.id,
            created_at=current,
            undo_until=current + window(),
        )
        db.add(tx)
        if auto_approve:
            adjust_balance(db, user, tx.amount)
        return tx

    @staticmethod
    def open_for_change(db: Session, user: User, tx_id: int) -> Transaction:
        """The member's purchase, locked, or an error if its window has closed."""
        tx = (
            db.query(Transaction)
            .filter(Transaction.id == tx_id, Transaction.user_id == user.id, Transaction.type == "purchase")
            .with_for_update()
            .first()
        )
        if not tx:
            raise HTTPException(status_code=404, detail="Purchase not found")
        if tx.status not in OPEN_STATUSES or tx.undo_until is None or now() > tx.undo_until + GRACE:
            raise HTTPException(status_code=409, detail="This purchase can no longer be changed")
        return tx

    @staticmethod
    def set_quantity(db: Session, tx: Transaction, quantity: int) -> None:
        _set_quantity(db, tx, quantity)

    @staticmethod
    def cancel(db: Session, tx: Transaction) -> None:
        if tx.status == "approved":
            adjust_balance(db, tx.user, -tx.amount)
        tx.status = "cancelled"
        tx.undo_until = None

    @staticmethod
    def settle(tx: Transaction) -> None:
        """Close the window early: the member is happy with the purchase as it is."""
        tx.undo_until = None

    @staticmethod
    def undoable(db: Session, user: User) -> list[Transaction]:
        return (
            db.query(Transaction)
            .filter(
                Transaction.user_id == user.id,
                Transaction.type == "purchase",
                Transaction.status.in_(OPEN_STATUSES),
                Transaction.undo_until > now(),
            )
            .order_by(Transaction.created_at.desc())
            .all()
        )
