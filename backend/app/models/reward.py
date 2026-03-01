from datetime import datetime, timezone
from sqlalchemy import Boolean, CheckConstraint, DateTime, Float, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class Reward(Base):
    __tablename__ = "rewards"
    __table_args__ = (
        CheckConstraint(
            "reward_type IN ('one_time', 'recurring')",
            name="ck_reward_type",
        ),
        CheckConstraint(
            "recurrence_frequency IS NULL OR recurrence_frequency IN ('daily', 'weekly', 'monthly', 'yearly')",
            name="ck_recurrence_frequency",
        ),
    )

    # Primary key
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # Reward configuration
    name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    reward_type: Mapped[str] = mapped_column(String, nullable=False)  # 'one_time' or 'recurring'

    # Recurring reward settings (NULL for one-time rewards)
    recurrence_frequency: Mapped[str | None] = mapped_column(String, nullable=True)  # 'daily', 'weekly', 'monthly', 'yearly'
    next_grant_date: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    # User assignment (JSON array of user IDs)
    assigned_user_ids: Mapped[str] = mapped_column(Text, nullable=False)  # JSON: "[1,2,3]" or "[]" for all users

    # Status
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    # Audit fields
    created_by_id: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
