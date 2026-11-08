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


class AdminProductOut(ProductOut):
    """A product as admins see it, with its cost price."""

    cost_price: Money | None = None


class ProductCreate(BaseModel):
    name: str
    price: MoneyIn
    cost_price: MoneyIn | None = None
    emoji: str = "🍺"
    sort_order: int = 0


class ProductUpdate(BaseModel):
    name: str | None = None
    price: MoneyIn | None = None
    cost_price: MoneyIn | None = None
    emoji: str | None = None
    is_active: bool | None = None
    sort_order: int | None = None
