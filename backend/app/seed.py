"""Seed the database with default products, admin users, fiscal period, and message templates."""

from app.config import settings
from app.database import SessionLocal
from app.models.fiscal_period import FiscalPeriod
from app.models.message_template import MessageTemplate
from app.models.product import Product
from app.models.user import User

PRODUCTS = [
    {"name": "Olut", "price": 1.00, "emoji": "🍺", "sort_order": 0},
    {"name": "Siideri", "price": 2.00, "emoji": "🍏", "sort_order": 1},
    {"name": "Limsa", "price": 1.00, "emoji": "🥤", "sort_order": 2},
    {"name": "Lonkero", "price": 2.00, "emoji": "🍋", "sort_order": 3},
]

MESSAGE_TEMPLATES = [
    {
        "event_type": "fiscal_period_closed",
        "template": "Dear {user}, the fiscal period has ended. You have {amount} \u20ac in outstanding debt. Please settle your balance!",
    },
    {
        "event_type": "user_approved",
        "template": "Hello {user}! Your registration has been approved. Open the app to get started!",
    },
    {
        "event_type": "payment_approved",
        "template": "Your payment of {amount} \u20ac has been approved!",
    },
    {
        "event_type": "payment_rejected",
        "template": "Your payment of {amount} \u20ac has been rejected.",
    },
    {
        "event_type": "user_deactivated",
        "template": "Your account has been deactivated.",
    },
    {
        "event_type": "user_promoted",
        "template": "You have been promoted to admin!",
    },
    {
        "event_type": "user_demoted",
        "template": "Your admin privileges have been removed.",
    },
    {
        "event_type": "debt_payment_approved",
        "template": "Your debt payment of {amount} \u20ac has been confirmed. Thank you!",
    },
    {
        "event_type": "debt_payment_rejected",
        "template": "Your debt payment of {amount} \u20ac was not confirmed. Please contact an admin.",
    },
]


def seed():
    db = SessionLocal()
    try:
        # Seed products
        if db.query(Product).count() == 0:
            for p in PRODUCTS:
                db.add(Product(**p))
            db.commit()
            print(f"Seeded {len(PRODUCTS)} products.")

        # Bootstrap admin users from ADMIN_TELEGRAM_IDS env var
        for tid in settings.admin_ids:
            existing = db.query(User).filter(User.telegram_id == tid).first()
            if existing is None:
                user = User(
                    telegram_id=tid,
                    first_name="Admin",
                    is_admin=True,
                    is_active=True,
                )
                db.add(user)
                print(f"Bootstrapped admin user with telegram_id={tid}")
            elif not existing.is_admin:
                existing.is_admin = True
                print(f"Promoted existing user {existing.first_name} (telegram_id={tid}) to admin")
            db.commit()

        # Seed initial fiscal period
        if db.query(FiscalPeriod).count() == 0:
            db.add(FiscalPeriod())
            db.commit()
            print("Created initial fiscal period.")

        # Seed message templates
        if db.query(MessageTemplate).count() == 0:
            for t in MESSAGE_TEMPLATES:
                db.add(MessageTemplate(**t))
            db.commit()
            print(f"Seeded {len(MESSAGE_TEMPLATES)} message templates.")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
