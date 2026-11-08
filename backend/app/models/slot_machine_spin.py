from datetime import UTC, datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.user import User

if TYPE_CHECKING:
    from app.models.transaction import Transaction


class SlotMachineSpin(Base):
    __tablename__ = "slot_machine_spins"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    bet_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    win_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    symbols: Mapped[str] = mapped_column(String, nullable=False)  # JSON string of symbols
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=lambda: datetime.now(UTC))
    # The 'game' transaction that applied this spin to the balance
    transaction_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("transactions.id"), nullable=True)

    user: Mapped[User] = relationship(foreign_keys=[user_id])
    transaction: Mapped["Transaction | None"] = relationship("Transaction", foreign_keys=[transaction_id])
