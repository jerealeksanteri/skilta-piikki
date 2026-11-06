from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.auth.telegram import require_admin
from app.database import get_db
from app.models.user import User
from app.routers.transactions import _to_out
from app.schemas.report import ProductSummary, PurchaseReport, UserSummary
from app.services.reports import ReportService, to_naive_utc

router = APIRouter()

Status = Literal["pending", "approved", "rejected"]


def _money(value: float) -> float:
    return round(value, 2)


@router.get("/admin/reports/purchases", response_model=PurchaseReport)
def purchase_report(
    start: datetime,
    end: datetime,
    status: list[Status] = Query(default=["approved", "pending"]),
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    if to_naive_utc(start) >= to_naive_utc(end):
        raise HTTPException(status_code=400, detail="Start must be before end")

    statuses = sorted(set(status))
    data = ReportService.purchase_report(db, start, end, statuses)

    def product_out(p) -> ProductSummary:
        return ProductSummary(
            product_id=p.product_id,
            product_name=p.product_name,
            emoji=p.emoji,
            items=p.items,
            amount=_money(p.amount),
        )

    return PurchaseReport(
        start=start,
        end=end,
        statuses=statuses,
        total_items=data.total_items,
        total_amount=_money(data.total_amount),
        user_count=len(data.by_user),
        by_product=[product_out(p) for p in data.by_product],
        by_user=[
            UserSummary(
                user_id=u.user_id,
                user_name=u.user_name,
                items=u.items,
                amount=_money(u.amount),
                products=[product_out(p) for p in u.products],
            )
            for u in data.by_user
        ],
        transaction_count=data.transaction_count,
        transactions_truncated=data.transaction_count > len(data.transactions),
        transactions=[_to_out(tx) for tx in data.transactions],
    )
