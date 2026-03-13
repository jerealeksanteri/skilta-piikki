from datetime import datetime, timezone

from sqlalchemy import DateTime, Float, Integer, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.user import User


class SlotMachineSpin(Base):
    __tablename__ = "slot_machine_spins"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    bet_amount: Mapped[float] = mapped_column(Float, nullable=False)
    win_amount: Mapped[float] = mapped_column(Float, nullable=False)
    symbols: Mapped[str] = mapped_column(String, nullable=False)  # JSON string of symbols
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=lambda: datetime.now(timezone.utc)
    )

    user: Mapped[User] = relationship(foreign_keys=[user_id])
