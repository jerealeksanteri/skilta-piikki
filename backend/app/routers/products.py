from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth.telegram import get_current_user, require_admin
from app.database import get_db
from app.models.product import Product
from app.models.user import User
from app.schemas.product import ProductCreate, ProductOut, ProductUpdate

router = APIRouter()


@router.get("/products", response_model=list[ProductOut])
def list_products(
    _user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return (
        db.query(Product)
        .filter(Product.is_active == True)  # noqa: E712
        .order_by(Product.sort_order, Product.name)
        .all()
    )


@router.post("/products", response_model=ProductOut)
def create_product(
    data: ProductCreate,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    product = Product(name=data.name, price=data.price, emoji=data.emoji)
    db.add(product)
    db.commit()
    db.refresh(product)
    return product


@router.put("/products/{product_id}", response_model=ProductOut)
def update_product(
    product_id: int,
    data: ProductUpdate,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(product, field, value)

    db.commit()
    db.refresh(product)
    return product


@router.delete("/products/{product_id}")
def delete_product(
    product_id: int,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    product.is_active = False
    db.commit()
    return {"ok": True}
