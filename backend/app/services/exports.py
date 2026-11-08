"""CSV exports for the treasurer.

Files are made on the backend in one of two formats:

- "excel_fi": what Finnish Excel opens straight into columns: semicolons,
  decimal commas, d.m.yyyy dates, a UTF-8 byte order mark (so ä and € show
  right) and CRLF line ends.
- "standard": commas, decimal points and ISO dates, for Google Sheets,
  scripts and other tools.

Times are shown in Helsinki time. Telegram's in-app download can't send our
auth header, so a download goes through a short-lived signed link: the admin
asks for one (POST /api/admin/exports), then fetches the file from it.
"""

import base64
import csv
import hashlib
import hmac
import io
import json
import secrets
import time
from collections.abc import Iterable
from datetime import UTC, datetime
from decimal import Decimal
from typing import Literal
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.config import settings
from app.models.fiscal_debt import FiscalDebt
from app.models.fiscal_period import FiscalPeriod
from app.models.transaction import Transaction
from app.money import to_cents
from app.services.fiscal_stats import period_stats
from app.services.reports import ReportService, to_naive_utc

Format = Literal["excel_fi", "standard"]
Kind = Literal["report_summary", "report_transactions", "fiscal_periods", "fiscal_debts"]

TIMEZONE = ZoneInfo("Europe/Helsinki")
LINK_TTL_SECONDS = 300

# Signing key for download links. Derived from the bot token so links survive a
# restart; without one (local dev) a random key per process is enough.
_KEY = (
    hashlib.sha256(b"skilta-piikki export link:" + settings.BOT_TOKEN.encode()).digest()
    if settings.BOT_TOKEN
    else secrets.token_bytes(32)
)


# --- signed links -------------------------------------------------------------


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def _unb64(text: str) -> bytes:
    return base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))


def sign(payload: dict, ttl: int = LINK_TTL_SECONDS) -> str:
    body = _b64(json.dumps({**payload, "exp": int(time.time()) + ttl}, separators=(",", ":")).encode())
    mac = _b64(hmac.new(_KEY, body.encode(), hashlib.sha256).digest())
    return f"{body}.{mac}"


def verify(token: str) -> dict | None:
    """The payload of a valid, unexpired link, else None."""
    try:
        body, mac = token.split(".", 1)
        expected = _b64(hmac.new(_KEY, body.encode(), hashlib.sha256).digest())
        if not hmac.compare_digest(mac, expected):
            return None
        payload = json.loads(_unb64(body))
    except (ValueError, json.JSONDecodeError):
        return None
    return payload if payload.get("exp", 0) >= time.time() else None


# --- formatting -----------------------------------------------------------------


class CsvTable:
    """Rows of cells written in the chosen format."""

    def __init__(self, fmt: Format, header: list[str]):
        self.fmt = fmt
        self.rows: list[list[str]] = [header]

    def money(self, value: Decimal | None) -> str:
        if value is None:
            return ""
        text = f"{to_cents(value):.2f}"
        return text.replace(".", ",") if self.fmt == "excel_fi" else text

    def pct(self, value: float | None) -> str:
        if value is None:
            return ""
        text = f"{value:.1f}"
        return text.replace(".", ",") if self.fmt == "excel_fi" else text

    def when(self, value: datetime | None) -> str:
        """A stored naive-UTC time in Helsinki time."""
        if value is None:
            return ""
        local = (value if value.tzinfo else value.replace(tzinfo=UTC)).astimezone(TIMEZONE)
        return (
            f"{local.day}.{local.month}.{local.year} {local:%H:%M}"
            if self.fmt == "excel_fi"
            else f"{local:%Y-%m-%d %H:%M}"
        )

    @staticmethod
    def text(value: str | None) -> str:
        """Free text, made safe from spreadsheet formula injection (=, +, -, @ at the start)."""
        if not value:
            return ""
        return "'" + value if value[0] in "=+-@\t\r" else value

    def add(self, row: Iterable) -> None:
        self.rows.append(["" if cell is None else str(cell) for cell in row])

    def encode(self) -> bytes:
        out = io.StringIO()
        if self.fmt == "excel_fi":
            writer = csv.writer(out, delimiter=";", lineterminator="\r\n")
        else:
            writer = csv.writer(out, delimiter=",", lineterminator="\n")
        writer.writerows(self.rows)
        data = out.getvalue().encode("utf-8")
        return b"\xef\xbb\xbf" + data if self.fmt == "excel_fi" else data


# --- the exports ----------------------------------------------------------------


def _day(value: datetime) -> str:
    return to_naive_utc(value).replace(tzinfo=UTC).astimezone(TIMEZONE).strftime("%Y-%m-%d")


def file_name(kind: Kind, params: dict) -> str:
    if kind in ("report_summary", "report_transactions"):
        what = "summary" if kind == "report_summary" else "transactions"
        start, end = datetime.fromisoformat(params["start"]), datetime.fromisoformat(params["end"])
        return f"piikki-purchases-{what}-{_day(start)}_{_day(end)}.csv"
    if kind == "fiscal_periods":
        return "piikki-fiscal-periods.csv"
    return f"piikki-fiscal-debts-period-{params['period_id']}.csv"


def _report_summary(db: Session, fmt: Format, params: dict) -> CsvTable:
    data = ReportService.purchase_report(
        db, datetime.fromisoformat(params["start"]), datetime.fromisoformat(params["end"]), params["statuses"]
    )
    table = CsvTable(
        fmt,
        ["Product", "Items", "Revenue €", "Cost €", "Profit €", "Margin %", "Items without cost price"],
    )
    for p in data.by_product:
        f = p.profit.fields()
        table.add(
            [
                table.text(p.product_name or "(deleted product)"),
                p.items,
                table.money(p.amount),
                table.money(f["cost"]),
                table.money(f["profit"]),
                table.pct(f["margin_pct"]),
                f["cost_missing_items"],
            ]
        )
    total = data.profit.fields()
    table.add(
        [
            "Total",
            data.total_items,
            table.money(data.total_amount),
            table.money(total["cost"]),
            table.money(total["profit"]),
            table.pct(total["margin_pct"]),
            total["cost_missing_items"],
        ]
    )
    return table


def _report_transactions(db: Session, fmt: Format, params: dict) -> CsvTable:
    start, end = (
        to_naive_utc(datetime.fromisoformat(params["start"])),
        to_naive_utc(datetime.fromisoformat(params["end"])),
    )
    rows = db.scalars(
        select(Transaction)
        .options(joinedload(Transaction.user), joinedload(Transaction.product))
        .where(*ReportService._filters(start, end, params["statuses"]))
        .order_by(Transaction.created_at, Transaction.id)
    )
    table = CsvTable(fmt, ["Time", "Member", "Product", "Quantity", "Amount €", "Cost per item €", "Status", "Note"])
    for tx in rows:
        table.add(
            [
                table.when(tx.created_at),
                table.text(tx.user.first_name if tx.user else ""),
                table.text(tx.product.name if tx.product else ""),
                tx.quantity,
                table.money(-tx.amount),
                table.money(tx.unit_cost),
                tx.status,
                table.text(tx.note),
            ]
        )
    return table


def _fiscal_periods(db: Session, fmt: Format, params: dict) -> CsvTable:
    table = CsvTable(
        fmt,
        [
            "Started",
            "Ended",
            "Purchases",
            "Purchases €",
            "Profit €",
            "Margin %",
            "Items without cost price",
            "Payments",
            "Payments €",
            "Debt €",
            "Debt collected €",
            "Debt outstanding €",
        ],
    )
    for period in db.query(FiscalPeriod).order_by(FiscalPeriod.started_at):
        s = period_stats(db, period)
        table.add(
            [
                table.when(s.started_at),
                table.when(s.ended_at),
                s.total_purchases,
                table.money(s.total_purchase_amount),
                table.money(s.purchase_profit),
                table.pct(s.margin_pct),
                s.cost_missing_items,
                s.total_payments,
                table.money(s.total_payment_amount),
                table.money(s.total_debt),
                table.money(s.debt_collected),
                table.money(s.debt_outstanding),
            ]
        )
    return table


def _fiscal_debts(db: Session, fmt: Format, params: dict) -> CsvTable:
    debts = (
        db.query(FiscalDebt)
        .options(joinedload(FiscalDebt.user))
        .filter(FiscalDebt.fiscal_period_id == params["period_id"])
        .order_by(FiscalDebt.amount.desc(), FiscalDebt.id)
    )
    table = CsvTable(fmt, ["Member", "Debt €", "Status", "Paid"])
    for debt in debts:
        table.add(
            [
                table.text(debt.user.first_name if debt.user else ""),
                table.money(debt.amount),
                debt.status,
                table.when(debt.paid_at),
            ]
        )
    return table


_BUILDERS = {
    "report_summary": _report_summary,
    "report_transactions": _report_transactions,
    "fiscal_periods": _fiscal_periods,
    "fiscal_debts": _fiscal_debts,
}


def build(db: Session, kind: Kind, fmt: Format, params: dict) -> bytes:
    return _BUILDERS[kind](db, fmt, params).encode()
