import logging

from sqlalchemy.orm import Session

from app.models.message_template import MessageTemplate
from app.models.user import User
from app.services.telegram_bot import send_message

logger = logging.getLogger(__name__)


def send_event_message(
    db: Session, event_type: str, user: User, variables: dict
) -> bool:
    template = (
        db.query(MessageTemplate)
        .filter(MessageTemplate.event_type == event_type, MessageTemplate.is_active == True)  # noqa: E712
        .first()
    )
    if not template:
        return False

    try:
        text = template.template.format(**variables)
    except (KeyError, IndexError):
        logger.error("Failed to render template '%s' with vars %s", event_type, variables)
        return False

    return send_message(user.telegram_id, text)


def send_bulk_event_message(
    db: Session, event_type: str, users_and_vars: list[tuple[User, dict]]
) -> int:
    template = (
        db.query(MessageTemplate)
        .filter(MessageTemplate.event_type == event_type, MessageTemplate.is_active == True)  # noqa: E712
        .first()
    )
    if not template:
        return 0

    sent = 0
    for user, variables in users_and_vars:
        try:
            text = template.template.format(**variables)
        except (KeyError, IndexError):
            logger.error("Failed to render template '%s' for user %s", event_type, user.id)
            continue
        if send_message(user.telegram_id, text):
            sent += 1
    return sent
