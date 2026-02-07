from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth.telegram import get_current_user, require_admin
from app.database import get_db
from app.models.user import User
from app.schemas.user import UserOut

router = APIRouter()


@router.get("/me", response_model=UserOut)
def get_me(user: User = Depends(get_current_user)):
    return user


@router.get("/users", response_model=list[UserOut])
def list_users(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return db.query(User).order_by(User.first_name).all()
