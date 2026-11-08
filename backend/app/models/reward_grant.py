from datetime import UTC, datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.reward import Reward
    from app.models.transaction import Transaction
    from app.models.user import User


class RewardGrant(Base):
    __tablename__ = "reward_grants"
    __table_args__ = (
        # A user can receive each scheduled occurrence of a reward only once.
        # Manual grants have scheduled_for = NULL and are not restricted.
        UniqueConstraint("reward_id", "user_id", "scheduled_for", name="uq_reward_grants_occurrence"),
    )

    # Primary key
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # References
    reward_id: Mapped[int] = mapped_column(Integer, ForeignKey("rewards.id"), nullable=False)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    transaction_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("transactions.id"), nullable=True)

    # Grant details (denormalized for history)
    reward_name: Mapped[str] = mapped_column(String, nullable=False)
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Grant metadata
    granted_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=lambda: datetime.now(UTC))
    granted_by_scheduler: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    # The schedule occurrence this grant pays out (NULL for manual grants)
    scheduled_for: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    # Relationships
    user: Mapped["User"] = relationship("User", foreign_keys=[user_id])
    reward: Mapped["Reward"] = relationship("Reward", foreign_keys=[reward_id])
    transaction: Mapped["Transaction | None"] = relationship("Transaction", foreign_keys=[transaction_id])
