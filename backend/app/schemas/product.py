from pydantic import BaseModel


class ProductOut(BaseModel):
    id: int
    name: str
    price: float
    emoji: str
    is_active: bool

    model_config = {"from_attributes": True}


class ProductCreate(BaseModel):
    name: str
    price: float
    emoji: str = "🍺"


class ProductUpdate(BaseModel):
    name: str | None = None
    price: float | None = None
    emoji: str | None = None
    is_active: bool | None = None
