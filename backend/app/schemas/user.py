from datetime import datetime

from pydantic import BaseModel


class UserOut(BaseModel):
    id: int
    telegram_id: int
    first_name: str
    last_name: str | None
    username: str | None
    is_admin: bool
    balance: float
    created_at: datetime

    model_config = {"from_attributes": True}
