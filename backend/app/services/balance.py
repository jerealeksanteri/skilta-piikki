from decimal import Decimal

from sqlalchemy import update
from sqlalchemy.orm import Session

from app.models.user import User


def adjust_balance(db: Session, user: User, delta: Decimal) -> None:
    """Add ``delta`` to the user's balance atomically.

    Issues ``UPDATE users SET balance = balance + :delta`` instead of writing
    back a value computed in Python, so two requests changing the same balance
    at the same time can't overwrite each other. The row stays locked until
    the surrounding transaction commits. ``user.balance`` is reloaded on next
    access.
    """
    db.execute(
        update(User)
        .where(User.id == user.id)
        .values(balance=User.balance + delta)
        .execution_options(synchronize_session=False)
    )
    db.expire(user, ["balance"])
