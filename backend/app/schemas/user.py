from pydantic import BaseModel

from app.schemas.common import UtcDatetime


class UserCreate(BaseModel):
    telegram_id: int
    first_name: str
    last_name: str | None = None
    username: str | None = None


class UserBulkCreate(BaseModel):
    users: list[UserCreate]


class UserOut(BaseModel):
    id: int
    telegram_id: int
    first_name: str
    last_name: str | None
    username: str | None
    is_admin: bool
    is_active: bool
    balance: float
    created_at: UtcDatetime

    model_config = {"from_attributes": True}


class MeOut(UserOut):
    fiscal_debt_total: float = 0.0
    total_balance: float = 0.0
