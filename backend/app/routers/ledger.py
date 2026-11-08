from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth.telegram import require_admin
from app.database import get_db
from app.models.user import User
from app.schemas.ledger import LedgerCheckOut
from app.services import ledger

router = APIRouter()


@router.get("/admin/ledger-check", response_model=LedgerCheckOut)
def get_ledger_check(
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """The latest check of every balance against its transactions (runs nightly)."""
    return ledger.last_check(db) or LedgerCheckOut(checked_at=None)


@router.post("/admin/ledger-check", response_model=LedgerCheckOut)
def run_ledger_check(
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Check every balance now."""
    return ledger.run_check(db)
