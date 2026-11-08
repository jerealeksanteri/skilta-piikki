from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth.telegram import require_active_user, require_admin
from app.config import settings
from app.database import get_db
from app.models.product import Product
from app.models.transaction import Transaction
from app.models.user import User
from app.schemas.transaction import (
    PaymentRequest,
    PurchaseRequest,
    QuantityUpdate,
    TransactionOut,
    UserPaymentRequest,
)
from app.services.audit import diff, record, snapshot
from app.services.balance import adjust_balance
from app.services.messaging import send_event_message
from app.services.purchases import PurchaseService, remaining_ms

router = APIRouter()


def _to_out(tx: Transaction) -> TransactionOut:
    return TransactionOut(
        id=tx.id,
        user_id=tx.user_id,
        product_id=tx.product_id,
        type=tx.type,
        amount=tx.amount,
        status=tx.status,
        approved_by_id=tx.approved_by_id,
        created_by_id=tx.created_by_id,
        created_by_name=tx.created_by.first_name if tx.created_by else None,
        quantity=tx.quantity,
        note=tx.note,
        created_at=tx.created_at,
        product_name=tx.product.name if tx.product else None,
        user_name=tx.user.first_name if tx.user else None,
        product_emoji=tx.product.emoji if tx.product else None,
        **_undo_fields(tx),
    )


def _undo_fields(tx: Transaction) -> dict:
    left = remaining_ms(tx)
    if left is None:
        return {}
    return {"undo_remaining_ms": left, "undo_window_ms": settings.UNDO_WINDOW_SECONDS * 1000}


@router.post("/transactions/purchase", response_model=TransactionOut)
def create_purchase(
    data: PurchaseRequest,
    user: User = Depends(require_active_user),
    db: Session = Depends(get_db),
):
    product = db.query(Product).filter(Product.id == data.product_id, Product.is_active == True).first()  # noqa: E712
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    tx = PurchaseService.create(db, user, product, max(1, data.quantity))
    db.commit()
    db.refresh(tx)
    return _to_out(tx)


@router.get("/transactions/undoable", response_model=list[TransactionOut])
def undoable_purchases(
    user: User = Depends(require_active_user),
    db: Session = Depends(get_db),
):
    """The member's purchases that can still be changed or cancelled, newest first."""
    return [_to_out(tx) for tx in PurchaseService.undoable(db, user)]


@router.put("/transactions/{tx_id}/quantity", response_model=TransactionOut)
def change_purchase_quantity(
    tx_id: int,
    data: QuantityUpdate,
    user: User = Depends(require_active_user),
    db: Session = Depends(get_db),
):
    tx = PurchaseService.open_for_change(db, user, tx_id)
    PurchaseService.set_quantity(db, tx, data.quantity)
    db.commit()
    db.refresh(tx)
    return _to_out(tx)


@router.post("/transactions/{tx_id}/cancel", response_model=TransactionOut)
def cancel_purchase(
    tx_id: int,
    user: User = Depends(require_active_user),
    db: Session = Depends(get_db),
):
    tx = PurchaseService.open_for_change(db, user, tx_id)
    PurchaseService.cancel(db, tx)
    db.commit()
    db.refresh(tx)
    return _to_out(tx)


@router.post("/transactions/payment", response_model=TransactionOut)
def create_payment(
    data: PaymentRequest,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    target_user = db.query(User).filter(User.id == data.user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    if data.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")

    tx = Transaction(
        user_id=target_user.id,
        type="payment",
        amount=data.amount,
        status="pending",
        note=data.note,
        created_by_id=admin.id,
    )
    db.add(tx)
    db.flush()
    record(
        db,
        admin,
        "payment.create",
        tx,
        label=f"Payment {tx.amount} € · {target_user.first_name}",
        changes=diff({}, snapshot(tx, "amount", "status", "note")),
    )
    db.commit()
    db.refresh(tx)
    return _to_out(tx)


@router.post("/transactions/payment-request", response_model=TransactionOut)
def create_payment_request(
    data: UserPaymentRequest,
    user: User = Depends(require_active_user),
    db: Session = Depends(get_db),
):
    if data.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")

    tx = Transaction(
        user_id=user.id,
        type="payment",
        amount=data.amount,
        status="pending",
        note=data.note,
        created_by_id=user.id,
    )
    db.add(tx)
    db.commit()
    db.refresh(tx)
    return _to_out(tx)


@router.get("/transactions/mine", response_model=list[TransactionOut])
def my_transactions(
    include_games: bool = False,
    user: User = Depends(require_active_user),
    db: Session = Depends(get_db),
):
    query = db.query(Transaction).filter(Transaction.user_id == user.id, Transaction.status != "cancelled")
    if not include_games:
        # Slot machine spins would push everything else out of the latest 50.
        query = query.filter(Transaction.type != "game")
    txs = query.order_by(Transaction.created_at.desc()).limit(50).all()
    return [_to_out(tx) for tx in txs]


@router.get("/transactions/pending", response_model=list[TransactionOut])
def pending_transactions(
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    txs = db.query(Transaction).filter(Transaction.status == "pending").order_by(Transaction.created_at.desc()).all()
    return [_to_out(tx) for tx in txs]


@router.put("/transactions/{tx_id}/approve", response_model=TransactionOut)
def approve_transaction(
    tx_id: int,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    tx = db.query(Transaction).filter(Transaction.id == tx_id).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    if tx.status != "pending":
        raise HTTPException(status_code=400, detail="Transaction is not pending")

    tx.status = "approved"
    tx.approved_by_id = admin.id

    target_user = db.query(User).filter(User.id == tx.user_id).first()

    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    adjust_balance(db, target_user, tx.amount)
    record(
        db,
        admin,
        "transaction.approve",
        tx,
        label=f"{tx.type.capitalize()} {tx.amount} € · {target_user.first_name}",
        changes={"status": {"from": "pending", "to": "approved"}},
    )

    db.commit()
    db.refresh(tx)

    if tx.type == "payment":
        send_event_message(
            db,
            "payment_approved",
            target_user,
            {
                "user": target_user.first_name,
                "amount": f"{tx.amount:.2f}",
            },
        )

    return _to_out(tx)


@router.put("/transactions/{tx_id}/reject", response_model=TransactionOut)
def reject_transaction(
    tx_id: int,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    tx = db.query(Transaction).filter(Transaction.id == tx_id).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    if tx.status != "pending":
        raise HTTPException(status_code=400, detail="Transaction is not pending")

    tx.status = "rejected"
    tx.approved_by_id = admin.id
    record(
        db,
        admin,
        "transaction.reject",
        tx,
        label=f"{tx.type.capitalize()} {tx.amount} € · {tx.user.first_name}",
        changes={"status": {"from": "pending", "to": "rejected"}},
    )

    db.commit()
    db.refresh(tx)

    if tx.type == "payment":
        target_user = db.query(User).filter(User.id == tx.user_id).first()
        if target_user:
            send_event_message(
                db,
                "payment_rejected",
                target_user,
                {
                    "user": target_user.first_name,
                    "amount": f"{tx.amount:.2f}",
                },
            )

    return _to_out(tx)
