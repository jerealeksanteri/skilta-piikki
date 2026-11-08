"""Admin audit log.

Call `record()` before the endpoint's `db.commit()`: the entry is written in
the same transaction as the change, so a rolled-back change leaves no entry.

    before = snapshot(product, "name", "price")
    product.price = data.price
    record(db, admin, "product.update", product, label=product.name,
           changes=diff(before, snapshot(product, "name", "price")))
"""

import json
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog
from app.models.user import User
from app.money import to_cents


def _jsonable(value: Any) -> Any:
    if isinstance(value, Decimal):
        return str(to_cents(value))  # money, exact and in cents: "1.20", not 1.2
    if isinstance(value, datetime | date):
        return value.isoformat()
    return value


def snapshot(obj: Any, *fields: str) -> dict[str, Any]:
    """The current values of some attributes, ready to compare and store."""
    return {f: _jsonable(getattr(obj, f)) for f in fields}


def diff(before: dict[str, Any], after: dict[str, Any]) -> dict[str, dict[str, Any]]:
    """Only the fields whose value changed, as {"field": {"from": ..., "to": ...}}."""
    return {f: {"from": before.get(f), "to": value} for f, value in after.items() if before.get(f) != value}


def record(
    db: Session,
    actor: User | None,
    action: str,
    target: Any = None,
    *,
    label: str | None = None,
    changes: dict[str, dict[str, Any]] | None = None,
    note: str | None = None,
) -> AuditLog:
    """Add an audit entry to the session (no commit). `target` is any model with an id."""
    entry = AuditLog(
        actor_id=actor.id if actor else None,
        actor_name=actor.first_name if actor else "System",
        action=action,
        target_type=type(target).__tablename__ if target is not None else None,
        target_id=getattr(target, "id", None),
        target_label=label,
        changes=json.dumps(changes) if changes else None,
        note=note,
    )
    db.add(entry)
    return entry
