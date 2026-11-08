from datetime import datetime
from decimal import Decimal

import pytest

from app.models.audit_log import AuditLog
from app.models.fiscal_debt import FiscalDebt
from app.models.fiscal_period import FiscalPeriod
from app.models.transaction import Transaction
from app.services import exports

WINDOW = {"start": "2026-11-01T00:00:00Z", "end": "2026-11-10T00:00:00Z"}


@pytest.fixture
def admin(make_user):
    return make_user("Admin", is_admin=True)


@pytest.fixture
def sales(db, make_user, make_product, make_purchase):
    """Two members' purchases on 8 Nov 2026 at 18:30 UTC (20:30 in Helsinki)."""
    beer = make_product("Olut", Decimal("2.50"))
    soda = make_product("Limsa", Decimal("1.00"))
    alice = make_user("Äijä")
    evil = make_user("=HYPERLINK(1)")
    tx = make_purchase(alice, beer, 3, datetime(2026, 11, 8, 18, 30))
    tx.unit_cost = Decimal("1.00")
    make_purchase(evil, soda, 1, datetime(2026, 11, 8, 18, 45))
    db.commit()


def _download(client, **body):
    r = client.post("/api/admin/exports", json=body)
    assert r.status_code == 200, r.text
    link = r.json()
    file = client.get(link["url"])
    assert file.status_code == 200, file.text
    assert file.headers["content-type"].startswith("text/csv")
    assert link["file_name"] in file.headers["content-disposition"]
    return link["file_name"], file.content


def test_summary_in_finnish_excel_format(client_as, admin, sales):
    name, body = _download(client_as(admin), kind="report_summary", format="excel_fi", **WINDOW)

    assert name == "piikki-purchases-summary-2026-11-01_2026-11-10.csv"
    assert body.startswith(b"\xef\xbb\xbf")  # BOM, so Excel reads ä and €
    lines = body[3:].decode().split("\r\n")
    assert lines[0] == "Product;Items;Revenue €;Cost €;Profit €;Margin %;Items without cost price"
    assert lines[1] == "Olut;3;7,50;3,00;4,50;60,0;0"
    assert lines[2] == "Limsa;1;1,00;;;;1"
    assert lines[3] == "Total;4;8,50;3,00;4,50;60,0;1"


def test_summary_in_standard_format(client_as, admin, sales):
    _, body = _download(client_as(admin), kind="report_summary", format="standard", **WINDOW)

    assert not body.startswith(b"\xef\xbb\xbf")
    lines = body.decode().splitlines()
    assert lines[1] == "Olut,3,7.50,3.00,4.50,60.0,0"


def test_transactions_are_complete_local_time_and_safe(client_as, admin, sales):
    _, body = _download(client_as(admin), kind="report_transactions", format="excel_fi", **WINDOW)

    lines = body[3:].decode().split("\r\n")
    assert lines[0] == "Time;Member;Product;Quantity;Amount €;Cost per item €;Status;Note"
    assert lines[1] == "8.11.2026 20:30;Äijä;Olut;3;7,50;1,00;approved;"
    # A name that looks like a formula is escaped, so a spreadsheet shows it as text.
    assert lines[2].startswith("8.11.2026 20:45;'=HYPERLINK(1);Limsa;1;1,00;")


def test_fiscal_periods_and_debts(db, client_as, admin, make_user):
    bob = make_user("Bob")
    period = FiscalPeriod(started_at=datetime(2026, 9, 1), ended_at=datetime(2026, 10, 1))
    db.add(period)
    db.flush()
    db.add(FiscalDebt(fiscal_period_id=period.id, user_id=bob.id, amount=Decimal("12.40"), status="unpaid"))
    db.commit()

    _, periods = _download(client_as(admin), kind="fiscal_periods", format="standard")
    name, debts = _download(client_as(admin), kind="fiscal_debts", format="standard", period_id=period.id)

    assert periods.decode().splitlines()[1].startswith("2026-09-01 03:00,2026-10-01 03:00,0,0.00,")
    assert name == f"piikki-fiscal-debts-period-{period.id}.csv"
    assert debts.decode().splitlines() == ["Member,Debt €,Status,Paid", "Bob,12.40,unpaid,"]


def test_export_is_audited(db, client_as, admin, sales):
    _download(client_as(admin), kind="report_summary", **WINDOW)

    (entry,) = db.query(AuditLog).filter(AuditLog.action == "report.export").all()
    assert entry.target_label == "Purchase summary (piikki-purchases-summary-2026-11-01_2026-11-10.csv)"


def test_links_are_checked(db, client_as, admin, make_user):
    client = client_as(admin)
    link = client.post("/api/admin/exports", json={"kind": "fiscal_periods"}).json()["url"]
    token = link.rsplit("/", 1)[1]

    assert client.get(link[:-3] + "abc").status_code == 404  # tampered
    expired = exports.sign({"kind": "fiscal_periods", "format": "standard", "params": {}, "admin": admin.id}, ttl=-1)
    assert client.get(f"/api/exports/{expired}").status_code == 404
    admin.is_admin = False
    db.commit()
    assert client.get(f"/api/exports/{token}").status_code == 403  # no longer an admin


def test_only_admins_get_links(make_user, client_as):
    assert client_as(make_user("Alice")).post("/api/admin/exports", json={"kind": "fiscal_periods"}).status_code == 403


def test_bad_requests(client_as, admin):
    client = client_as(admin)
    assert client.post("/api/admin/exports", json={"kind": "report_summary"}).status_code == 400
    assert client.post("/api/admin/exports", json={"kind": "fiscal_debts", "period_id": 999}).status_code == 404
    assert client.post("/api/admin/exports", json={"kind": "nope"}).status_code == 422


def test_cancelled_purchases_are_not_exported(db, client_as, admin, sales):
    db.query(Transaction).filter(Transaction.quantity == 1).update({"status": "cancelled"})
    db.commit()

    _, body = _download(client_as(admin), kind="report_transactions", format="standard", **WINDOW)

    assert len(body.decode().splitlines()) == 2  # header + the one beer row
