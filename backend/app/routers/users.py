from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth.telegram import get_current_user, require_admin
from app.database import get_db
from app.models.user import User
from app.schemas.user import UserBulkCreate, UserCreate, UserOut

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


@router.get("/leaderboard", response_model=list[UserOut])
def leaderboard(
    _user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return (
        db.query(User)
        .filter(User.is_active == True)  # noqa: E712
        .order_by(User.balance.asc())
        .all()
    )


@router.post("/users", response_model=UserOut)
def create_user(
    data: UserCreate,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    existing = db.query(User).filter(User.telegram_id == data.telegram_id).first()
    if existing:
        raise HTTPException(status_code=409, detail="User with this telegram_id already exists")

    user = User(
        telegram_id=data.telegram_id,
        first_name=data.first_name,
        last_name=data.last_name,
        username=data.username,
        added_by_id=admin.id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/users/bulk", response_model=list[UserOut])
def bulk_create_users(
    data: UserBulkCreate,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    created = []
    for u in data.users:
        existing = db.query(User).filter(User.telegram_id == u.telegram_id).first()
        if existing:
            continue
        user = User(
            telegram_id=u.telegram_id,
            first_name=u.first_name,
            last_name=u.last_name,
            username=u.username,
            added_by_id=admin.id,
        )
        db.add(user)
        created.append(user)
    db.commit()
    for u in created:
        db.refresh(u)
    return created


@router.delete("/users/all")
def delete_all_non_admin_users(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    users = db.query(User).filter(User.is_admin == False).all()  # noqa: E712
    count = 0
    for user in users:
        user.is_active = False
        user.balance = 0.0
        count += 1
    db.commit()
    return {"deactivated": count}


@router.put("/users/{user_id}/activate", response_model=UserOut)
def activate_user(
    user_id: int,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_active = True
    db.commit()
    db.refresh(user)
    return user


@router.put("/users/{user_id}/deactivate", response_model=UserOut)
def deactivate_user(
    user_id: int,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot deactivate yourself")
    user.is_active = False
    db.commit()
    db.refresh(user)
    return user


@router.put("/users/{user_id}/promote", response_model=UserOut)
def promote_user(
    user_id: int,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_admin = True
    db.commit()
    db.refresh(user)
    return user


@router.put("/users/{user_id}/demote", response_model=UserOut)
def demote_user(
    user_id: int,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot demote yourself")
    # Ensure at least one admin remains
    admin_count = db.query(User).filter(User.is_admin == True, User.is_active == True).count()  # noqa: E712
    if admin_count <= 1:
        raise HTTPException(status_code=400, detail="Cannot demote the last admin")
    user.is_admin = False
    db.commit()
    db.refresh(user)
    return user
