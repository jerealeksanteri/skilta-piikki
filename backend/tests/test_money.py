from datetime import datetime
from decimal import Decimal

import pytest

from app.models.transaction import Transaction
from app.money import to_cents
from app.services.slot_machine import SlotMachineService


@pytest.mark.parametrize(
    ("value", "expected"),
    [(0.1, "0.10"), (2.675, "2.68"), ("1.005", "1.01"), (Decimal("-6.9999999"), "-7.00"), (3, "3.00")],
)
def test_to_cents_rounds_half_up_without_float_drift(value, expected):
    assert to_cents(value) == Decimal(expected)


def test_small_payments_add_up_exactly(db, make_user, client_as):
    admin = make_user("Admin", is_admin=True)
    alice = make_user("Alice")
    client = client_as(admin)

    for amount in (0.1, 0.2):
        tx = client.post("/api/transactions/payment", json={"user_id": alice.id, "amount": amount}).json()
        client.put(f"/api/transactions/{tx['id']}/approve")

    db.refresh(alice)
    assert alice.balance == Decimal("0.30")


def test_amounts_are_json_numbers(db, make_user, make_product, client_as):
    alice = make_user("Alice")
    beer = make_product("Beer", Decimal("1.10"))

    body = client_as(alice).post("/api/transactions/purchase", json={"product_id": beer.id, "quantity": 3}).json()

    assert body["amount"] == -3.3
    assert isinstance(body["amount"], float)


def test_more_than_two_decimals_is_rejected(make_user, client_as):
    admin = make_user("Admin", is_admin=True)
    alice = make_user("Alice")

    r = client_as(admin).post("/api/transactions/payment", json={"user_id": alice.id, "amount": 1.234})

    assert r.status_code == 422


def test_report_totals_are_exact(db, make_user, make_product, make_purchase, client_as):
    admin = make_user("Admin", is_admin=True)
    candy = make_product("Candy", Decimal("0.10"))
    for _ in range(3):
        make_purchase(admin, candy, 1, datetime(2026, 11, 8, 12))

    r = client_as(admin).get(
        "/api/admin/reports/purchases", params={"start": "2026-11-08T00:00:00Z", "end": "2026-11-09T00:00:00Z"}
    )

    assert r.json()["total_amount"] == 0.3
    assert db.query(Transaction).count() == 3


def test_slot_payouts_are_whole_cents():
    bet = SlotMachineService.BET_AMOUNT
    assert SlotMachineService._calculate_payout(["seven"] * 3, bet) == Decimal("50.00")
    assert SlotMachineService._calculate_payout(["cherry", "lemon", "cherry"], bet) == Decimal("1.00")
    assert SlotMachineService._calculate_payout(["cherry", "lemon", "plum"], bet) == Decimal("0.00")
