from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth.telegram import get_current_user, require_admin
from app.database import get_db
from app.models.product import Product
from app.models.user import User
from app.schemas.product import AdminProductOut, ProductCreate, ProductOut, ProductUpdate
from app.services.audit import diff, record, snapshot

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


@router.get("/products/all", response_model=list[AdminProductOut])
def list_all_products(
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return db.query(Product).order_by(Product.sort_order, Product.name).all()


@router.post("/products", response_model=AdminProductOut)
def create_product(
    data: ProductCreate,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    product = Product(
        name=data.name, price=data.price, cost_price=data.cost_price, emoji=data.emoji, sort_order=data.sort_order
    )
    db.add(product)
    db.flush()
    record(
        db,
        admin,
        "product.create",
        product,
        label=product.name,
        changes=diff({}, snapshot(product, "name", "price", "cost_price", "emoji", "sort_order")),
    )
    db.commit()
    db.refresh(product)
    return product


@router.put("/products/{product_id}", response_model=AdminProductOut)
def update_product(
    product_id: int,
    data: ProductUpdate,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    before = snapshot(product, "name", "price", "cost_price", "emoji", "sort_order", "is_active")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(product, field, value)
    changes = diff(before, snapshot(product, "name", "price", "cost_price", "emoji", "sort_order", "is_active"))
    if changes:
        record(db, admin, "product.update", product, label=product.name, changes=changes)

    db.commit()
    db.refresh(product)
    return product


@router.delete("/products/{product_id}")
def delete_product(
    product_id: int,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    record(
        db,
        admin,
        "product.deactivate",
        product,
        label=product.name,
        changes={"is_active": {"from": product.is_active, "to": False}},
    )
    product.is_active = False
    db.commit()
    return {"ok": True}
