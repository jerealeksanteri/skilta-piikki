import logging

import httpx

from app.config import settings

logger = logging.getLogger(__name__)


def send_message(telegram_id: int, text: str) -> bool:
    if settings.DEV_MODE:
        logger.info("[DEV] Would send to %s: %s", telegram_id, text)
        return True

    if not settings.BOT_TOKEN:
        logger.warning("BOT_TOKEN not set, skipping message send")
        return False

    url = f"https://api.telegram.org/bot{settings.BOT_TOKEN}/sendMessage"
    try:
        resp = httpx.post(url, json={"chat_id": telegram_id, "text": text}, timeout=10)
        if resp.status_code != 200:
            logger.error("Telegram API error %s: %s", resp.status_code, resp.text)
            return False
        return True
    except Exception:
        logger.exception("Failed to send Telegram message to %s", telegram_id)
        return False
