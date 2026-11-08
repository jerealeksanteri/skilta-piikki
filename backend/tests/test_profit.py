from datetime import timedelta
from decimal import Decimal

import pytest

from app.models.audit_log import AuditLog
from app.models.fiscal_period import FiscalPeriod
from app.services.reward_schedule import utcnow


@pytest.fixture
def admin(make_user):
    return make_user("Admin", is_admin=True)


@pytest.fixture
def menu(db, make_product):
    beer = make_product("Beer", Decimal("2.50"))
    beer.cost_price = Decimal("1.00")
    soda = make_product("Soda", Decimal("1.00"))  # no cost price
    db.commit()
    return beer, soda


def _buy(client, product, quantity=1):
    r = client.post("/api/transactions/purchase", json={"product_id": product.id, "quantity": quantity})
    assert r.status_code == 200, r.text
    # Settle it, so the next purchase of the same drink is a new row.
    client.post(f"/api/transactions/{r.json()['id']}/settle")


def _report(client):
    now = utcnow()
    params = {"start": (now - timedelta(days=1)).isoformat() + "Z", "end": (now + timedelta(days=1)).isoformat() + "Z"}
    r = client.get("/api/admin/reports/purchases", params=params)
    assert r.status_code == 200, r.text
    return r.json()


def test_report_shows_profit_and_margin(client_as, admin, menu):
    beer, _ = menu
    _buy(client_as(admin), beer, 3)

    report = _report(client_as(admin))

    (row,) = report["by_product"]
    assert (row["amount"], row["cost"], row["profit"], row["margin_pct"]) == (7.5, 3.0, 4.5, 60.0)
    assert (report["total_cost"], report["total_profit"], report["margin_pct"]) == (3.0, 4.5, 60.0)


def test_missing_cost_is_not_counted_as_profit(client_as, admin, menu):
    beer, soda = menu
    _buy(client_as(admin), beer, 2)
    _buy(client_as(admin), soda, 4)

    report = _report(client_as(admin))

    rows = {r["product_name"]: r for r in report["by_product"]}
    assert (rows["Soda"]["cost"], rows["Soda"]["profit"], rows["Soda"]["cost_missing_items"]) == (None, None, 4)
    assert report["total_amount"] == 9.0
    assert (report["total_profit"], report["margin_pct"], report["cost_missing_items"]) == (3.0, 60.0, 4)


def test_cost_change_does_not_rewrite_past_profit(db, client_as, admin, menu):
    beer, _ = menu
    _buy(client_as(admin), beer)
    client_as(admin).put(f"/api/products/{beer.id}", json={"cost_price": 2.0})
    _buy(client_as(admin), beer)

    (row,) = _report(client_as(admin))["by_product"]

    assert (row["cost"], row["profit"]) == (3.0, 2.0)  # 1.00 + 2.00 cost on 5.00 revenue


def test_cost_price_is_admin_only(make_user, client_as, admin, menu):
    alice = make_user("Alice")

    assert "cost_price" not in client_as(alice).get("/api/products").json()[0]
    assert {p["name"]: p["cost_price"] for p in client_as(admin).get("/api/products/all").json()} == {
        "Beer": 1.0,
        "Soda": None,
    }


def test_set_and_clear_cost_is_audited(db, client_as, admin, menu):
    _, soda = menu
    client_as(admin).put(f"/api/products/{soda.id}", json={"cost_price": 0.4})
    r = client_as(admin).put(f"/api/products/{soda.id}", json={"cost_price": None})

    assert r.json()["cost_price"] is None
    changes = [a.changes for a in db.query(AuditLog).filter(AuditLog.action == "product.update").order_by(AuditLog.id)]
    assert '"cost_price"' in changes[0] and '"0.40"' in changes[0]
    assert '"to": null' in changes[1]


def test_fiscal_summary_has_profit(db, client_as, admin, menu):
    beer, soda = menu
    period = FiscalPeriod(started_at=utcnow() - timedelta(days=1))
    db.add(period)
    db.commit()
    _buy(client_as(admin), beer, 4)
    _buy(client_as(admin), soda)

    stats = client_as(admin).get(f"/api/fiscal-periods/{period.id}/stats").json()

    assert stats["total_purchase_amount"] == 11.0
    assert (stats["purchase_cost"], stats["purchase_profit"], stats["margin_pct"]) == (4.0, 6.0, 60.0)
    assert stats["cost_missing_items"] == 1
