from decimal import Decimal

from pydantic import BaseModel

from app.schemas.common import Money, UtcDatetime


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
    balance: Money
    created_at: UtcDatetime

    model_config = {"from_attributes": True}


class MeOut(UserOut):
    fiscal_debt_total: Money = Decimal("0.00")
    total_balance: Money = Decimal("0.00")
