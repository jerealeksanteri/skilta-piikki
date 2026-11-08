"""Sample data for local development.

    docker compose exec backend python -m app.dev_seed

Adds a few members (one still waiting for approval), some purchases and a
pending payment request, and a monthly recurring reward. Safe to run again:
it does nothing once the sample members exist. Refuses to run unless
DEV_MODE is on, so it can't touch a real database.
"""

import json
import sys
from datetime import timedelta

from app.config import settings
from app.database import SessionLocal
from app.models.product import Product
from app.models.reward import Reward
from app.models.transaction import Transaction
from app.models.user import User
from app.services.balance import adjust_balance
from app.services.reward_schedule import next_occurrence_after, utcnow

MEMBERS = [
    # telegram_id, first name, username, active
    (1001, "Aino", "aino", True),
    (1002, "Mikko", "mikko", True),
    (1003, "Liisa", "liisa", True),
    (1004, "Pekka", "pekka", False),
]

# (member index, product name, quantity, days ago)
PURCHASES = [
    (0, "Olut", 2, 0),
    (0, "Lonkero", 1, 1),
    (1, "Siideri", 3, 0),
    (1, "Olut", 1, 2),
    (2, "Limsa", 2, 1),
]


def main() -> None:
    if not settings.DEV_MODE:
        sys.exit("Refusing to seed: DEV_MODE is off. This script is for local development only.")

    # Same setup the app runs on startup, so this also works on a fresh database.
    from app.main import run_migrations
    from app.seed import seed

    run_migrations()
    seed()

    db = SessionLocal()
    try:
        if db.query(User).filter(User.telegram_id == MEMBERS[0][0]).first():
            print("Sample data is already there; nothing to do.")
            return

        members = []
        for telegram_id, name, username, active in MEMBERS:
            user = User(telegram_id=telegram_id, first_name=name, username=username, is_active=active)
            db.add(user)
            members.append(user)
        db.flush()

        products = {p.name: p for p in db.query(Product)}
        now = utcnow()
        for index, product_name, quantity, days_ago in PURCHASES:
            user, product = members[index], products[product_name]
            amount = -product.price * quantity
            db.add(
                Transaction(
                    user_id=user.id,
                    product_id=product.id,
                    type="purchase",
                    amount=amount,
                    quantity=quantity,
                    status="approved",
                    created_by_id=user.id,
                    created_at=now - timedelta(days=days_ago, hours=index),
                )
            )
            adjust_balance(db, user, amount)

        db.add(
            Transaction(
                user_id=members[1].id,
                type="payment",
                amount=5.0,
                status="pending",
                created_by_id=members[1].id,
                note="MobilePay",
            )
        )

        admin = db.query(User).filter(User.is_admin == True).first()  # noqa: E712
        db.add(
            Reward(
                name="Board member bonus",
                description="Thanks for running the guild",
                amount=5.0,
                reward_type="recurring",
                recurrence_frequency="monthly",
                schedule_anchor=now,
                next_grant_date=next_occurrence_after(now, "monthly", now),
                assigned_user_ids=json.dumps([members[0].id]),
                created_by_id=admin.id if admin else members[0].id,
            )
        )

        db.commit()
        print(f"Added {len(MEMBERS)} members, {len(PURCHASES)} purchases, 1 pending payment and 1 recurring reward.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
