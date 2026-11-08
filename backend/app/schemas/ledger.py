from pydantic import BaseModel

from app.schemas.common import Money, UtcDatetime


class LedgerMismatch(BaseModel):
    user_id: int
    user_name: str
    balance: Money
    ledger_total: Money
    difference: Money


class LedgerCheckOut(BaseModel):
    # None until the first check has run
    checked_at: UtcDatetime | None
    users_checked: int = 0
    mismatches: list[LedgerMismatch] = []
