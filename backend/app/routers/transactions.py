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
    TransactionOut,
    UserPaymentRequest,
)

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
        note=tx.note,
        created_at=tx.created_at,
        product_name=tx.product.name if tx.product else None,
        user_name=tx.user.first_name if tx.user else None,
    )


@router.post("/transactions/purchase", response_model=TransactionOut)
def create_purchase(
    data: PurchaseRequest,
    user: User = Depends(require_active_user),
    db: Session = Depends(get_db),
):
    product = db.query(Product).filter(Product.id == data.product_id, Product.is_active == True).first()  # noqa: E712
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    auto_approve = settings.AUTO_APPROVE_PURCHASES
    tx = Transaction(
        user_id=user.id,
        product_id=product.id,
        type="purchase",
        amount=-product.price,
        status="approved" if auto_approve else "pending",
        created_by_id=user.id,
    )
    db.add(tx)

    if auto_approve:
        user.balance += tx.amount

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
    user: User = Depends(require_active_user),
    db: Session = Depends(get_db),
):
    txs = (
        db.query(Transaction)
        .filter(Transaction.user_id == user.id)
        .order_by(Transaction.created_at.desc())
        .limit(50)
        .all()
    )
    return [_to_out(tx) for tx in txs]


@router.get("/transactions/pending", response_model=list[TransactionOut])
def pending_transactions(
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    txs = (
        db.query(Transaction)
        .filter(Transaction.status == "pending")
        .order_by(Transaction.created_at.desc())
        .all()
    )
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
    
    target_user.balance += tx.amount

    db.commit()
    db.refresh(tx)
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

    db.commit()
    db.refresh(tx)
    return _to_out(tx)
