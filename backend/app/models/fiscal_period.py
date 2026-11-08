from datetime import UTC, datetime

from sqlalchemy import DateTime, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class FiscalPeriod(Base):
    __tablename__ = "fiscal_periods"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    started_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=lambda: datetime.now(UTC))
    ended_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=lambda: datetime.now(UTC))

    debts: Mapped[list["FiscalDebt"]] = relationship(back_populates="fiscal_period")  # noqa: F821
