"""CSV downloads for admins, through short-lived signed links (see services/exports.py)."""

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth.telegram import require_admin
from app.database import get_db
from app.models.fiscal_period import FiscalPeriod
from app.models.user import User
from app.schemas.common import UtcDatetime
from app.services import exports
from app.services.audit import record
from app.services.reports import to_naive_utc

router = APIRouter()

_LABELS = {
    "report_summary": "Purchase summary",
    "report_transactions": "Purchase transactions",
    "fiscal_periods": "Fiscal periods",
    "fiscal_debts": "Fiscal period debts",
}


class ExportRequest(BaseModel):
    kind: exports.Kind
    format: exports.Format = "excel_fi"
    # Purchase report exports: the same window and statuses as on screen.
    start: UtcDatetime | None = None
    end: UtcDatetime | None = None
    statuses: list[Literal["pending", "approved", "rejected"]] = ["approved", "pending"]
    # Fiscal debts export.
    period_id: int | None = None


class ExportLink(BaseModel):
    url: str
    file_name: str


def _params(data: ExportRequest, db: Session) -> dict:
    if data.kind in ("report_summary", "report_transactions"):
        if data.start is None or data.end is None:
            raise HTTPException(status_code=400, detail="Start and end are required")
        if to_naive_utc(data.start) >= to_naive_utc(data.end):
            raise HTTPException(status_code=400, detail="Start must be before end")
        return {"start": data.start.isoformat(), "end": data.end.isoformat(), "statuses": sorted(set(data.statuses))}
    if data.kind == "fiscal_debts":
        if data.period_id is None or not db.get(FiscalPeriod, data.period_id):
            raise HTTPException(status_code=404, detail="Period not found")
        return {"period_id": data.period_id}
    return {}


@router.post("/admin/exports", response_model=ExportLink)
def create_export(data: ExportRequest, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    """A download link, valid for a few minutes, for one CSV file."""
    params = _params(data, db)
    name = exports.file_name(data.kind, params)
    record(db, admin, "report.export", label=f"{_LABELS[data.kind]} ({name})")
    db.commit()
    token = exports.sign({"kind": data.kind, "format": data.format, "params": params, "admin": admin.id})
    return ExportLink(url=f"/api/exports/{token}", file_name=name)


@router.get("/exports/{token}")
def download_export(token: str, db: Session = Depends(get_db)):
    payload = exports.verify(token)
    if payload is None:
        raise HTTPException(status_code=404, detail="This download link has expired")
    admin = db.get(User, payload["admin"])
    if not admin or not admin.is_admin or not admin.is_active:
        raise HTTPException(status_code=403, detail="Admin access required")

    params = payload["params"]
    body = exports.build(db, payload["kind"], payload["format"], params)
    name = exports.file_name(payload["kind"], params)
    return Response(
        content=body,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{name}"', "Cache-Control": "no-store"},
    )
