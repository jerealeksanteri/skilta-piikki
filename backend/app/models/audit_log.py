from datetime import UTC, datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class AuditLog(Base):
    """One admin action: who did what to what, and which values changed."""

    __tablename__ = "audit_log"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    actor_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    # Names are copied so the log stays readable after a user is removed.
    actor_name: Mapped[str] = mapped_column(String, nullable=False)
    action: Mapped[str] = mapped_column(String, nullable=False, index=True)  # e.g. "transaction.approve"
    target_type: Mapped[str | None] = mapped_column(String, nullable=True)
    target_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    target_label: Mapped[str | None] = mapped_column(String, nullable=True)
    # JSON: {"field": {"from": old, "to": new}}
    changes: Mapped[str | None] = mapped_column(Text, nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=lambda: datetime.now(UTC), index=True
    )
