import time

from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.models.newsletter import Newsletter
from app.models.user import User
from app.services.audit import record
from app.services.telegram_bot import send_message
from app.services.telegram_html import (
    TELEGRAM_MESSAGE_LIMIT,
    sanitize_telegram_html,
    visible_length,
    visible_text,
)

# Stay well under Telegram's ~30 messages/second broadcast limit.
SEND_DELAY_SECONDS = 0.05
LOG_LIMIT = 100


class NewsletterError(ValueError):
    pass


class NewsletterService:
    @staticmethod
    def _recipients_query(audience: str):
        query = select(User).where(User.is_active == True)  # noqa: E712
        if audience == "admins":
            query = query.where(User.is_admin == True)  # noqa: E712
        return query

    @classmethod
    def audience_counts(cls, db: Session) -> dict[str, int]:
        def count(audience: str) -> int:
            sub = cls._recipients_query(audience).subquery()
            return db.scalar(select(func.count()).select_from(sub)) or 0

        return {"everyone": count("everyone"), "admins": count("admins")}

    @classmethod
    def send(cls, db: Session, sender: User, audience: str, markup: str, html: str) -> Newsletter:
        clean_html = sanitize_telegram_html(html)
        if not visible_text(clean_html).strip():
            raise NewsletterError("Message is empty")
        if visible_length(clean_html) > TELEGRAM_MESSAGE_LIMIT:
            raise NewsletterError(f"Message is longer than Telegram's {TELEGRAM_MESSAGE_LIMIT} character limit")

        recipients = list(db.scalars(cls._recipients_query(audience).order_by(User.id)))

        delivered = 0
        for i, user in enumerate(recipients):
            if i and SEND_DELAY_SECONDS:
                time.sleep(SEND_DELAY_SECONDS)
            if send_message(user.telegram_id, clean_html, parse_mode="HTML"):
                delivered += 1

        newsletter = Newsletter(
            created_by_id=sender.id,
            audience=audience,
            markup=markup,
            html=clean_html,
            recipient_count=len(recipients),
            delivered_count=delivered,
            failed_count=len(recipients) - delivered,
        )
        db.add(newsletter)
        db.flush()
        record(
            db,
            sender,
            "newsletter.send",
            newsletter,
            label=f"To {audience}",
            note=f"Delivered to {delivered} of {len(recipients)}",
        )
        db.commit()
        db.refresh(newsletter)
        return newsletter

    @staticmethod
    def list_recent(db: Session) -> list[Newsletter]:
        return list(
            db.scalars(
                select(Newsletter)
                .options(joinedload(Newsletter.created_by))
                .order_by(Newsletter.created_at.desc(), Newsletter.id.desc())
                .limit(LOG_LIMIT)
            )
        )
