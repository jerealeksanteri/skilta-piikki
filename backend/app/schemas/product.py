from pydantic import BaseModel

from app.schemas.common import Money, MoneyIn


class ProductOut(BaseModel):
    id: int
    name: str
    price: Money
    emoji: str
    is_active: bool
    sort_order: int

    model_config = {"from_attributes": True}


class ProductCreate(BaseModel):
    name: str
    price: MoneyIn
    emoji: str = "🍺"
    sort_order: int = 0


class ProductUpdate(BaseModel):
    name: str | None = None
    price: MoneyIn | None = None
    emoji: str | None = None
    is_active: bool | None = None
    sort_order: int | None = None
