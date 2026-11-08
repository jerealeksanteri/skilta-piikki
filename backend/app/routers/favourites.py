"""A member's favourite products, pinned at the top of the drinks menu."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth.telegram import require_active_user
from app.database import get_db
from app.models.product import Product
from app.models.user import User
from app.models.user_favourite import UserFavourite

router = APIRouter()


def _ids(db: Session, user: User) -> list[int]:
    rows = db.query(UserFavourite.product_id).filter(UserFavourite.user_id == user.id).all()
    return sorted(product_id for (product_id,) in rows)


@router.get("/favourites", response_model=list[int])
def list_favourites(user: User = Depends(require_active_user), db: Session = Depends(get_db)):
    """The ids of the member's favourite products."""
    return _ids(db, user)


@router.put("/favourites/{product_id}", response_model=list[int])
def add_favourite(product_id: int, user: User = Depends(require_active_user), db: Session = Depends(get_db)):
    if not db.get(Product, product_id):
        raise HTTPException(status_code=404, detail="Product not found")
    if not db.get(UserFavourite, (user.id, product_id)):
        db.add(UserFavourite(user_id=user.id, product_id=product_id))
        db.commit()
    return _ids(db, user)


@router.delete("/favourites/{product_id}", response_model=list[int])
def remove_favourite(product_id: int, user: User = Depends(require_active_user), db: Session = Depends(get_db)):
    favourite = db.get(UserFavourite, (user.id, product_id))
    if favourite:
        db.delete(favourite)
        db.commit()
    return _ids(db, user)
