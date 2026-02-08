from pydantic import BaseModel


class ProductOut(BaseModel):
    id: int
    name: str
    price: float
    emoji: str
    is_active: bool
    sort_order: int

    model_config = {"from_attributes": True}


class ProductCreate(BaseModel):
    name: str
    price: float
    emoji: str = "🍺"
    sort_order: int = 0


class ProductUpdate(BaseModel):
    name: str | None = None
    price: float | None = None
    emoji: str | None = None
    is_active: bool | None = None
    sort_order: int | None = None
