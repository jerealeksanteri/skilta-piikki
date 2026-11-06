from datetime import datetime

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.models  # noqa: F401  (registers all models on Base.metadata)
from app.auth.telegram import get_current_user
from app.database import Base, get_db
from app.main import app
from app.models.product import Product
from app.models.transaction import Transaction
from app.models.user import User


@pytest.fixture
def db():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine, autoflush=False)()
    try:
        yield session
    finally:
        session.close()
        engine.dispose()


@pytest.fixture
def make_user(db):
    counter = {"n": 0}

    def _make(name: str, is_admin: bool = False, is_active: bool = True) -> User:
        counter["n"] += 1
        user = User(
            telegram_id=1000 + counter["n"],
            first_name=name,
            is_admin=is_admin,
            is_active=is_active,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user

    return _make


@pytest.fixture
def make_product(db):
    def _make(name: str, price: float, emoji: str = "🍺") -> Product:
        product = Product(name=name, price=price, emoji=emoji)
        db.add(product)
        db.commit()
        db.refresh(product)
        return product

    return _make


@pytest.fixture
def make_purchase(db):
    def _make(
        user: User,
        product: Product,
        quantity: int,
        created_at: datetime,
        status: str = "approved",
        amount: float | None = None,
    ) -> Transaction:
        tx = Transaction(
            user_id=user.id,
            product_id=product.id,
            type="purchase",
            amount=amount if amount is not None else -(product.price * quantity),
            quantity=quantity,
            status=status,
            created_by_id=user.id,
            created_at=created_at,
        )
        db.add(tx)
        db.commit()
        db.refresh(tx)
        return tx

    return _make


@pytest.fixture
def client_as(db):
    """Return a factory producing a TestClient authenticated as the given user."""

    def _client(user: User) -> TestClient:
        app.dependency_overrides[get_db] = lambda: db
        app.dependency_overrides[get_current_user] = lambda: user
        return TestClient(app)

    yield _client
    app.dependency_overrides.clear()
