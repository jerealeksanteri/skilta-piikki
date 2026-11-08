from datetime import UTC, datetime
from decimal import Decimal

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Integer, Numeric, String, false
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.product import Product
from app.models.user import User


class Transaction(Base):
    __tablename__ = "transactions"
    __table_args__ = (
        CheckConstraint("type IN ('purchase', 'payment', 'reward', 'game', 'adjustment')", name="ck_transaction_type"),
        CheckConstraint(
            "status IN ('pending', 'approved', 'rejected', 'cancelled')",
            name="ck_transaction_status",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    product_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("products.id"), nullable=True)
    type: Mapped[str] = mapped_column(String, nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False, default="pending")
    approved_by_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    created_by_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    note: Mapped[str | None] = mapped_column(String, nullable=True)
    # Purchases only: the product's cost price per unit when it was bought, so a
    # later cost change doesn't rewrite past profit. None = cost wasn't known.
    unit_cost: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    # Purchases only: until when the member may still change or cancel it (naive UTC).
    undo_until: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    # Admin approve/reject: until when the decision can be undone (naive UTC), and
    # whether the user's message about it still waits for that window to close.
    decided_until: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    notice_pending: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default=false())
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=lambda: datetime.now(UTC))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )

    user: Mapped[User] = relationship(foreign_keys=[user_id])
    product: Mapped[Product | None] = relationship()
    approved_by: Mapped[User | None] = relationship(foreign_keys=[approved_by_id])
    created_by: Mapped[User | None] = relationship(foreign_keys=[created_by_id])
