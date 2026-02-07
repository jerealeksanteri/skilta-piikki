"""Seed the database with default products."""

from app.database import SessionLocal, Base, engine
from app.models.product import Product

PRODUCTS = [
    {"name": "Olut", "price": 2.00, "emoji": "🍺", "sort_order": 0},
    {"name": "Siideri", "price": 2.50, "emoji": "🍏", "sort_order": 1},
    {"name": "Limsa", "price": 1.00, "emoji": "🥤", "sort_order": 2},
    {"name": "Lonkero", "price": 2.50, "emoji": "🍋", "sort_order": 3},
]


def seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        if db.query(Product).count() == 0:
            for p in PRODUCTS:
                db.add(Product(**p))
            db.commit()
            print(f"Seeded {len(PRODUCTS)} products.")
        else:
            print("Products already exist, skipping seed.")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
