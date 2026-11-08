"""Admin approve / reject, with an undo window.

A decision takes effect at once (status, balance, audit log), but for
UNDO_WINDOW_SECONDS the admins can undo it from the "Just decided" list,
which puts the item back in Pending. The user's Telegram message about the
decision is held until the window closes, so an undone approval is never
announced; send_due_notices() sends the held messages, also any left over
from before a restart.
"""

import logging
from datetime import datetime, timedelta

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.config import settings
from app.models.transaction import Transaction
from app.models.user import User
from app.services.audit import record
from app.services.balance import adjust_balance
from app.services.messaging import send_event_message
from app.services.reward_schedule import utcnow

logger = logging.getLogger(__name__)

GRACE = timedelta(seconds=5)

# Which decisions the user hears about, and with which message template.
NOTICE_EVENTS = {
    ("payment", "approved"): "payment_approved",
    ("payment", "rejected"): "payment_rejected",
}

_VERBS = {"approved": "approve", "rejected": "reject"}


def now() -> datetime:
    """Current naive UTC time; tests replace this to move the clock."""
    return utcnow()


def window() -> timedelta:
    return timedelta(seconds=settings.UNDO_WINDOW_SECONDS)


def remaining_ms(tx: Transaction) -> int | None:
    if tx.decided_until is None or tx.status not in _VERBS:
        return None
    left = (tx.decided_until - now()).total_seconds()
    return int(left * 1000) if left > 0 else None


def _label(tx: Transaction) -> str:
    return f"{tx.type.capitalize()} {tx.amount} € · {tx.user.first_name}"


def _locked(db: Session, tx_id: int) -> Transaction:
    tx = db.query(Transaction).filter(Transaction.id == tx_id).with_for_update().first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return tx


class DecisionService:
    @staticmethod
    def decide(db: Session, tx_id: int, admin: User, approve: bool) -> Transaction:
        # Locked, so two admins tapping at once can't both apply it.
        tx = _locked(db, tx_id)
        if tx.status != "pending":
            raise HTTPException(status_code=400, detail="Transaction is not pending")

        status = "approved" if approve else "rejected"
        tx.status = status
        tx.approved_by_id = admin.id
        tx.decided_until = now() + window()
        tx.notice_pending = (tx.type, status) in NOTICE_EVENTS
        if approve:
            adjust_balance(db, tx.user, tx.amount)
        record(
            db,
            admin,
            f"transaction.{_VERBS[status]}",
            tx,
            label=_label(tx),
            changes={"status": {"from": "pending", "to": status}},
        )
        return tx

    @staticmethod
    def undo(db: Session, tx_id: int, admin: User) -> Transaction:
        tx = _locked(db, tx_id)
        if tx.status not in _VERBS or tx.decided_until is None or now() > tx.decided_until + GRACE:
            raise HTTPException(status_code=409, detail="This decision can no longer be undone")

        decided = tx.status
        if decided == "approved":
            adjust_balance(db, tx.user, -tx.amount)
        tx.status = "pending"
        tx.approved_by_id = None
        tx.decided_until = None
        tx.notice_pending = False
        record(
            db,
            admin,
            "transaction.undo_decision",
            tx,
            label=_label(tx),
            changes={"status": {"from": decided, "to": "pending"}},
        )
        return tx

    @staticmethod
    def recent(db: Session) -> list[Transaction]:
        """Decisions that can still be undone, newest first."""
        return (
            db.query(Transaction)
            .filter(Transaction.decided_until > now(), Transaction.status.in_(tuple(_VERBS)))
            .order_by(Transaction.decided_until.desc())
            .all()
        )


def send_due_notices(db: Session) -> int:
    """Send the held decision messages whose undo window has closed. Returns how many went out.

    Each row is claimed (flag cleared and committed) before its message is
    sent, so a crash can lose a message but never send one twice; a decision
    undone meanwhile has no flag left to claim.
    """
    sent = 0
    while True:
        tx = (
            db.query(Transaction)
            .filter(Transaction.notice_pending.is_(True), Transaction.decided_until <= now())
            .order_by(Transaction.decided_until)
            .with_for_update(skip_locked=True)
            .first()
        )
        if tx is None:
            return sent
        tx.notice_pending = False
        event = NOTICE_EVENTS.get((tx.type, tx.status))
        user = tx.user
        amount = tx.amount
        db.commit()
        if event and user:
            try:
                if send_event_message(db, event, user, {"user": user.first_name, "amount": f"{amount:.2f}"}):
                    sent += 1
            except Exception:
                logger.exception("Failed to send %s for transaction %s", event, tx.id)
