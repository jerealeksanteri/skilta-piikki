import hashlib
import hmac
import json
import time
from urllib.parse import parse_qs, unquote

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models.user import User

# Init data is valid for 1 hour
INIT_DATA_EXPIRY_SECONDS = 3600


def validate_init_data(init_data_raw: str, bot_token: str) -> dict:
    """Validate Telegram Mini App init data and return parsed data."""
    parsed = parse_qs(init_data_raw, keep_blank_values=True)

    # Extract hash
    received_hash = parsed.get("hash", [None])[0]
    if not received_hash:
        raise ValueError("Missing hash")

    # Build the check string: sorted key=value pairs excluding hash
    data_pairs = []
    for key, values in parsed.items():
        if key == "hash":
            continue
        data_pairs.append(f"{key}={values[0]}")
    data_pairs.sort()
    data_check_string = "\n".join(data_pairs)

    # Compute HMAC-SHA256
    secret_key = hmac.new(b"WebAppData", bot_token.encode(), hashlib.sha256).digest()
    computed_hash = hmac.new(
        secret_key, data_check_string.encode(), hashlib.sha256
    ).hexdigest()

    if not hmac.compare_digest(computed_hash, received_hash):
        raise ValueError("Invalid hash")

    # Check expiry
    auth_date_str = parsed.get("auth_date", [None])[0]
    if auth_date_str:
        auth_date = int(auth_date_str)
        if time.time() - auth_date > INIT_DATA_EXPIRY_SECONDS:
            raise ValueError("Init data expired")

    # Parse user JSON
    user_data_str = parsed.get("user", [None])[0]
    if not user_data_str:
        raise ValueError("Missing user data")

    return json.loads(unquote(user_data_str))


def _get_or_create_dev_user(db: Session) -> User:
    """Return a fake dev user, creating one if needed."""
    dev_telegram_id = 999999999
    user = db.query(User).filter(User.telegram_id == dev_telegram_id).first()
    if user is None:
        user = User(
            telegram_id=dev_telegram_id,
            first_name="Dev",
            last_name="User",
            username="devuser",
            is_admin=True,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    return user


def get_current_user(
    authorization: str | None = Header(None),
    db: Session = Depends(get_db),
) -> User:
    """Validate Telegram init data and return/create the user."""
    if settings.DEV_MODE:
        return _get_or_create_dev_user(db)

    if not authorization or not authorization.startswith("tma "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid Authorization header",
        )

    init_data_raw = authorization[4:]

    try:
        tg_user = validate_init_data(init_data_raw, settings.BOT_TOKEN)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e),
        )

    telegram_id = tg_user["id"]

    # Whitelist model: user must exist in DB (added by admin or seeded)
    user = db.query(User).filter(User.telegram_id == telegram_id).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Contact an admin to be added.",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has been deactivated. Contact an admin.",
        )

    # Update profile info from Telegram
    user.first_name = tg_user.get("first_name", user.first_name)
    user.last_name = tg_user.get("last_name", user.last_name)
    user.username = tg_user.get("username", user.username)
    db.commit()
    db.refresh(user)

    return user


def require_admin(user: User = Depends(get_current_user)) -> User:
    """Dependency that requires the current user to be an admin."""
    if not user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return user
