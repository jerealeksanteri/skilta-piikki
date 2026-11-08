from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.auth.telegram import get_current_user, require_admin
from app.database import get_db
from app.models.fiscal_debt import FiscalDebt
from app.models.user import User
from app.money import ZERO, to_cents
from app.schemas.user import MeOut, UserBulkCreate, UserCreate, UserOut
from app.services.audit import diff, record, snapshot
from app.services.ledger import record_adjustment
from app.services.messaging import send_event_message

router = APIRouter()


@router.get("/me", response_model=MeOut)
def get_me(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    debt_total = (
        db.query(func.coalesce(func.sum(FiscalDebt.amount), 0))
        .filter(
            FiscalDebt.user_id == user.id,
            FiscalDebt.status.in_(["unpaid", "payment_pending"]),
        )
        .scalar()
    )
    debt_total = to_cents(debt_total or 0)
    return MeOut(
        id=user.id,
        telegram_id=user.telegram_id,
        first_name=user.first_name,
        last_name=user.last_name,
        username=user.username,
        is_admin=user.is_admin,
        is_active=user.is_active,
        balance=user.balance,
        created_at=user.created_at,
        fiscal_debt_total=debt_total,
        total_balance=user.balance,
    )


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
    db.flush()
    record(
        db,
        admin,
        "user.create",
        user,
        label=user.first_name,
        changes=diff({}, snapshot(user, "telegram_id", "first_name", "last_name", "username")),
    )
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
    if created:
        record(
            db,
            admin,
            "user.bulk_create",
            note=f"Added {len(created)} members: " + ", ".join(u.first_name for u in created),
        )
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
    balance_total = sum((u.balance for u in users), ZERO)
    for user in users:
        user.is_active = False
        if user.balance != 0:
            record_adjustment(db, user, -user.balance, "Balance reset by an admin (all members reset)", admin.id)
        count += 1
    record(
        db,
        admin,
        "user.reset_all",
        note=f"Deactivated {count} non-admin members and set their balances to 0 (they totalled {balance_total} €)",
    )
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
    record(
        db,
        admin,
        "user.activate",
        user,
        label=user.first_name,
        changes={"is_active": {"from": user.is_active, "to": True}},
    )
    user.is_active = True
    db.commit()
    db.refresh(user)

    send_event_message(db, "user_approved", user, {"user": user.first_name})

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
    record(
        db,
        admin,
        "user.deactivate",
        user,
        label=user.first_name,
        changes={"is_active": {"from": user.is_active, "to": False}},
    )
    user.is_active = False
    db.commit()
    db.refresh(user)

    send_event_message(db, "user_deactivated", user, {"user": user.first_name})

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
    record(
        db,
        admin,
        "user.promote",
        user,
        label=user.first_name,
        changes={"is_admin": {"from": user.is_admin, "to": True}},
    )
    user.is_admin = True
    db.commit()
    db.refresh(user)

    send_event_message(db, "user_promoted", user, {"user": user.first_name})

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
    record(
        db,
        admin,
        "user.demote",
        user,
        label=user.first_name,
        changes={"is_admin": {"from": user.is_admin, "to": False}},
    )
    user.is_admin = False
    db.commit()
    db.refresh(user)

    send_event_message(db, "user_demoted", user, {"user": user.first_name})

    return user


@router.delete("/users/{user_id}/deny")
def deny_user(
    user_id: int,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.is_active:
        raise HTTPException(status_code=400, detail="Cannot deny an active user")
    if user.id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot deny yourself")

    user_name = user.first_name

    record(db, admin, "user.deny", user, label=user_name, note="Registration denied; the user was removed")
    # Delete the user from the database
    db.delete(user)
    db.commit()

    return {"message": f"User {user_name} has been denied and removed"}
