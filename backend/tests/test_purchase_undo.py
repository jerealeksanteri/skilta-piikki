from datetime import datetime, timedelta
from decimal import Decimal

import pytest

from app.config import settings
from app.models.transaction import Transaction
from app.services import ledger, purchases

START = datetime(2026, 11, 9, 18, 0, 0)


@pytest.fixture
def clock(monkeypatch):
    """A controllable server clock for the purchases service."""
    state = {"now": START}
    monkeypatch.setattr(purchases, "now", lambda: state["now"])

    class Clock:
        def advance(self, seconds: float) -> None:
            state["now"] += timedelta(seconds=seconds)

    return Clock()


@pytest.fixture
def beer(make_product):
    return make_product("Beer", Decimal("2.50"))


def _buy(client, product, quantity=1):
    r = client.post("/api/transactions/purchase", json={"product_id": product.id, "quantity": quantity})
    assert r.status_code == 200, r.text
    return r.json()


def _reconciled(db):
    return ledger.find_mismatches(db)[1] == []


def test_purchase_is_charged_at_once_and_open_for_a_minute(db, make_user, client_as, clock, beer):
    alice = make_user("Alice")

    tx = _buy(client_as(alice), beer)

    assert tx["undo_remaining_ms"] == 60_000
    db.refresh(alice)
    assert alice.balance == Decimal("-2.50")
    clock.advance(59)
    assert [t["id"] for t in client_as(alice).get("/api/transactions/undoable").json()] == [tx["id"]]
    clock.advance(2)
    assert client_as(alice).get("/api/transactions/undoable").json() == []


def test_change_quantity_moves_the_balance(db, make_user, client_as, clock, beer):
    alice = make_user("Alice")
    client = client_as(alice)
    tx = _buy(client, beer)

    r = client.put(f"/api/transactions/{tx['id']}/quantity", json={"quantity": 3})

    assert r.status_code == 200, r.text
    assert (r.json()["quantity"], r.json()["amount"]) == (3, -7.5)
    db.refresh(alice)
    assert alice.balance == Decimal("-7.50")
    assert _reconciled(db)


def test_cancel_reverses_the_charge_and_hides_it(db, make_user, client_as, clock, beer):
    alice = make_user("Alice")
    client = client_as(alice)
    tx = _buy(client, beer, quantity=2)

    r = client.post(f"/api/transactions/{tx['id']}/cancel")

    assert r.json()["status"] == "cancelled"
    assert r.json()["undo_remaining_ms"] is None
    db.refresh(alice)
    assert alice.balance == Decimal("0.00")
    assert client.get("/api/transactions/mine").json() == []
    assert _reconciled(db)


def test_tapping_the_same_drink_adds_to_the_open_purchase(db, make_user, client_as, clock, beer, make_product):
    alice = make_user("Alice")
    cider = make_product("Cider", Decimal("3.00"))
    client = client_as(alice)
    first = _buy(client, beer)
    clock.advance(40)

    again = _buy(client, beer, quantity=2)
    other = _buy(client, cider)

    assert again["id"] == first["id"]
    assert again["quantity"] == 3
    assert again["undo_remaining_ms"] == 60_000  # the window restarts
    assert other["id"] != first["id"]
    assert db.query(Transaction).count() == 2
    db.refresh(alice)
    assert alice.balance == Decimal("-10.50")


def test_tapping_after_the_window_starts_a_new_purchase(make_user, client_as, clock, beer):
    alice = make_user("Alice")
    first = _buy(client_as(alice), beer)
    clock.advance(61)

    assert _buy(client_as(alice), beer)["id"] != first["id"]


def test_late_requests_get_a_short_grace_then_are_refused(db, make_user, client_as, clock, beer):
    alice = make_user("Alice")
    client = client_as(alice)
    tx = _buy(client, beer)

    clock.advance(63)  # past the window, inside the grace for a slow network
    assert client.put(f"/api/transactions/{tx['id']}/quantity", json={"quantity": 2}).status_code == 200
    clock.advance(5)
    r = client.post(f"/api/transactions/{tx['id']}/cancel")

    assert r.status_code == 409
    db.refresh(alice)
    assert alice.balance == Decimal("-5.00")


def test_only_the_buyer_can_change_it(make_user, client_as, clock, beer):
    alice = make_user("Alice")
    bob = make_user("Bob")
    tx = _buy(client_as(alice), beer)

    assert client_as(bob).post(f"/api/transactions/{tx['id']}/cancel").status_code == 404


def test_quantity_must_stay_positive(make_user, client_as, clock, beer):
    alice = make_user("Alice")
    tx = _buy(client_as(alice), beer)

    r = client_as(alice).put(f"/api/transactions/{tx['id']}/quantity", json={"quantity": 0})

    assert r.status_code == 400


def test_price_change_meanwhile_keeps_the_purchase_price(db, make_user, client_as, clock, beer):
    alice = make_user("Alice")
    tx = _buy(client_as(alice), beer)
    beer.price = Decimal("9.99")
    db.commit()

    r = client_as(alice).put(f"/api/transactions/{tx['id']}/quantity", json={"quantity": 2})

    assert r.json()["amount"] == -5.0


def test_pending_purchase_cancel_needs_no_balance_change(db, make_user, client_as, clock, beer, monkeypatch):
    monkeypatch.setattr(settings, "AUTO_APPROVE_PURCHASES", False)
    admin = make_user("Admin", is_admin=True)
    alice = make_user("Alice")
    tx = _buy(client_as(alice), beer)
    assert tx["status"] == "pending"

    client_as(alice).post(f"/api/transactions/{tx['id']}/cancel")

    db.refresh(alice)
    assert alice.balance == Decimal("0.00")
    assert client_as(admin).get("/api/transactions/pending").json() == []


def test_cancelled_purchases_stay_out_of_reports(db, make_user, client_as, clock, beer):
    admin = make_user("Admin", is_admin=True)
    tx = _buy(client_as(admin), beer)
    client_as(admin).post(f"/api/transactions/{tx['id']}/cancel")

    report = (
        client_as(admin)
        .get(
            "/api/admin/reports/purchases",
            params={"start": "2026-11-09T00:00:00Z", "end": "2026-11-10T00:00:00Z"},
        )
        .json()
    )

    assert report["total_items"] == 0


def test_settle_closes_the_window_early(db, make_user, client_as, clock, beer):
    alice = make_user("Alice")
    client = client_as(alice)
    tx = _buy(client, beer)

    r = client.post(f"/api/transactions/{tx['id']}/settle")

    assert r.status_code == 200, r.text
    assert (r.json()["status"], r.json()["undo_remaining_ms"]) == ("approved", None)
    assert client.get("/api/transactions/undoable").json() == []
    assert client.post(f"/api/transactions/{tx['id']}/cancel").status_code == 409
    assert _buy(client, beer)["id"] != tx["id"]  # the next tap starts a new purchase
    db.refresh(alice)
    assert alice.balance == Decimal("-5.00")
