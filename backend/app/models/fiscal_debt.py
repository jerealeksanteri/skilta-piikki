from datetime import datetime, timezone

from sqlalchemy import CheckConstraint, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.fiscal_period import FiscalPeriod
from app.models.user import User


class FiscalDebt(Base):
    __tablename__ = "fiscal_debts"
    __table_args__ = (
        CheckConstraint(
            "status IN ('unpaid', 'payment_pending', 'paid')",
            name="ck_fiscal_debt_status",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    fiscal_period_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("fiscal_periods.id"), nullable=False
    )
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False
    )
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False, default="unpaid")
    paid_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=lambda: datetime.now(timezone.utc)
    )

    fiscal_period: Mapped[FiscalPeriod] = relationship(back_populates="debts")
    user: Mapped[User] = relationship()
