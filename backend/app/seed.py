"""Seed the database with default products and bootstrap admin users."""

from app.config import settings
from app.database import SessionLocal
from app.models.product import Product
from app.models.user import User

PRODUCTS = [
    {"name": "Olut", "price": 1.00, "emoji": "🍺", "sort_order": 0},
    {"name": "Siideri", "price": 2.00, "emoji": "🍏", "sort_order": 1},
    {"name": "Limsa", "price": 1.00, "emoji": "🥤", "sort_order": 2},
    {"name": "Lonkero", "price": 2.00, "emoji": "🍋", "sort_order": 3},
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
    finally:
        db.close()


if __name__ == "__main__":
    seed()
