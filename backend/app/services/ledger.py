"""The transaction ledger: every balance change is an approved transaction.

A user's balance must always equal the sum of their approved transactions.
`record_adjustment()` is for balance changes that aren't purchases, payments,
rewards or games (fiscal period resets, admin resets); `run_check()` verifies
the rule for every user and stores the result for the admin page.
"""

import json
import logging
from datetime import datetime
from decimal import Decimal

from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app.models.app_setting import AppSetting
from app.models.transaction import Transaction
from app.models.user import User
from app.money import ZERO, to_cents
from app.services.balance import adjust_balance
from app.services.reward_schedule import utcnow

logger = logging.getLogger(__name__)

CHECK_KEY = "ledger_check"


def record_adjustment(
    db: Session, user: User, amount: Decimal, note: str, created_by_id: int | None = None
) -> Transaction:
    """Change a balance outside the normal flows, with a transaction that says why. No commit."""
    tx = Transaction(
        user_id=user.id,
        type="adjustment",
        amount=amount,
        status="approved",
        created_by_id=created_by_id,
        approved_by_id=created_by_id,
        note=note,
    )
    db.add(tx)
    adjust_balance(db, user, amount)
    return tx


def find_mismatches(db: Session) -> tuple[int, list[dict]]:
    """(users checked, users whose balance differs from their approved transactions)."""
    approved_total = func.coalesce(func.sum(case((Transaction.status == "approved", Transaction.amount), else_=0)), 0)
    rows = db.execute(
        select(User.id, User.first_name, User.balance, approved_total)
        .outerjoin(Transaction, Transaction.user_id == User.id)
        .group_by(User.id, User.first_name, User.balance)
        .order_by(User.id)
    ).all()
    mismatches = [
        {
            "user_id": user_id,
            "user_name": name,
            "balance": str(to_cents(balance)),
            "ledger_total": str(to_cents(total)),
            "difference": str(to_cents(balance) - to_cents(total)),
        }
        for user_id, name, balance, total in rows
        if to_cents(balance) != to_cents(total)
    ]
    return len(rows), mismatches


def run_check(db: Session) -> dict:
    """Check every balance against the ledger and store the result. Commits."""
    users_checked, mismatches = find_mismatches(db)
    result = {"checked_at": utcnow().isoformat(), "users_checked": users_checked, "mismatches": mismatches}
    setting = db.get(AppSetting, CHECK_KEY)
    if setting is None:
        db.add(AppSetting(key=CHECK_KEY, value=json.dumps(result)))
    else:
        setting.value = json.dumps(result)
    db.commit()
    if mismatches:
        logger.warning("Ledger check: %d of %d balances don't match their transactions", len(mismatches), users_checked)
    return result


def last_check(db: Session) -> dict | None:
    setting = db.get(AppSetting, CHECK_KEY)
    if setting is None:
        return None
    result = json.loads(setting.value)
    result["checked_at"] = datetime.fromisoformat(result["checked_at"])
    return result


__all__ = ["ZERO", "find_mismatches", "last_check", "record_adjustment", "run_check"]
