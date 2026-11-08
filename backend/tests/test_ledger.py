from datetime import datetime
from decimal import Decimal

import pytest
from sqlalchemy import text

from app.models.fiscal_period import FiscalPeriod
from app.models.reward import Reward
from app.models.slot_machine_spin import SlotMachineSpin
from app.models.transaction import Transaction
from app.services import ledger
from app.services.slot_machine import SlotMachineService


@pytest.fixture
def jackpot(monkeypatch):
    """Make every spin three sevens (a 50 € win on a 1 € bet)."""
    monkeypatch.setattr(SlotMachineService, "spin", classmethod(lambda cls, bet: (["seven"] * 3, Decimal("50.00"))))


def _balance_matches_ledger(db):
    _, mismatches = ledger.find_mismatches(db)
    return mismatches == []


def test_spin_is_a_game_transaction(db, make_user, client_as, jackpot):
    alice = make_user("Alice")

    r = client_as(alice).post("/api/slot-machine/spin", json={})

    assert r.status_code == 200, r.text
    (tx,) = db.query(Transaction).filter(Transaction.type == "game").all()
    assert (tx.amount, tx.status, tx.note) == (Decimal("49.00"), "approved", "Slot machine: seven seven seven")
    assert db.query(SlotMachineSpin).one().transaction_id == tx.id
    db.refresh(alice)
    assert alice.balance == Decimal("49.00")
    assert _balance_matches_ledger(db)


def test_history_hides_games_unless_asked(db, make_user, make_product, client_as, jackpot):
    alice = make_user("Alice")
    beer = make_product("Beer", Decimal("1.00"))
    client = client_as(alice)
    client.post("/api/transactions/purchase", json={"product_id": beer.id})
    client.post("/api/slot-machine/spin", json={})

    default = client.get("/api/transactions/mine").json()
    with_games = client.get("/api/transactions/mine", params={"include_games": True}).json()

    assert [t["type"] for t in default] == ["purchase"]
    assert sorted(t["type"] for t in with_games) == ["game", "purchase"]


def test_fiscal_close_resets_through_adjustments(db, make_user, client_as):
    admin = make_user("Admin", is_admin=True)
    alice = make_user("Alice")
    gone = make_user("Gone", is_active=False)
    for user, amount in ((alice, "-6.00"), (gone, "-2.00")):
        db.add(Transaction(user_id=user.id, type="purchase", amount=Decimal(amount), status="approved"))
        user.balance = Decimal(amount)
    db.add(FiscalPeriod(started_at=datetime(2026, 9, 1)))
    db.commit()

    client_as(admin).post("/api/fiscal-periods/close")

    adjustments = {t.user_id: t for t in db.query(Transaction).filter(Transaction.type == "adjustment")}
    assert adjustments[alice.id].amount == Decimal("6.00")
    assert adjustments[alice.id].note == "Fiscal period closed: 6.00 € moved to your debts"
    assert adjustments[gone.id].note == "Fiscal period closed: negative balance reset"
    db.refresh(alice)
    assert alice.balance == Decimal("0.00")
    assert _balance_matches_ledger(db)


def test_reset_all_uses_adjustments(db, make_user, client_as):
    admin = make_user("Admin", is_admin=True)
    alice = make_user("Alice")
    db.add(Transaction(user_id=alice.id, type="payment", amount=Decimal("4.50"), status="approved"))
    alice.balance = Decimal("4.50")
    db.commit()

    client_as(admin).delete("/api/users/all")

    (adj,) = db.query(Transaction).filter(Transaction.type == "adjustment").all()
    assert (adj.user_id, adj.amount, adj.created_by_id) == (alice.id, Decimal("-4.50"), admin.id)
    assert _balance_matches_ledger(db)


def test_every_flow_keeps_balances_reconciled(db, make_user, make_product, client_as, jackpot):
    admin = make_user("Admin", is_admin=True)
    alice = make_user("Alice")
    beer = make_product("Beer", Decimal("2.50"))
    reward = Reward(
        name="Helper", amount=Decimal("3.00"), reward_type="one_time", assigned_user_ids="[]", created_by_id=admin.id
    )
    db.add_all([reward, FiscalPeriod(started_at=datetime(2026, 9, 1))])
    db.commit()
    # client_as() switches the logged-in user for the whole app, so pick it per request.

    client_as(alice).post("/api/transactions/purchase", json={"product_id": beer.id, "quantity": 30})  # -75.00
    tx = client_as(admin).post("/api/transactions/payment", json={"user_id": alice.id, "amount": 10}).json()
    client_as(admin).put(f"/api/transactions/{tx['id']}/approve")  # +10.00
    client_as(admin).post("/api/rewards/grant", json={"reward_id": reward.id, "user_ids": [alice.id]})  # +3.00
    client_as(admin).post("/api/fiscal-periods/close")  # -62.00 -> 0 (debt 62.00)
    client_as(alice).post("/api/slot-machine/spin", json={})  # +49.00

    db.refresh(alice)
    assert alice.balance == Decimal("49.00")
    assert _balance_matches_ledger(db)


def test_check_finds_a_tampered_balance(db, make_user, client_as):
    admin = make_user("Admin", is_admin=True)
    alice = make_user("Alice")
    client = client_as(admin)
    assert client.get("/api/admin/ledger-check").json() == {"checked_at": None, "users_checked": 0, "mismatches": []}

    db.execute(text("UPDATE users SET balance = 5 WHERE id = :id"), {"id": alice.id})
    db.commit()
    run = client.post("/api/admin/ledger-check").json()

    assert run["users_checked"] == 2
    assert run["mismatches"] == [
        {"user_id": alice.id, "user_name": "Alice", "balance": 5.0, "ledger_total": 0.0, "difference": 5.0}
    ]
    stored = client.get("/api/admin/ledger-check").json()
    assert stored["checked_at"].endswith(("Z", "+00:00"))
    assert stored["mismatches"] == run["mismatches"]


def test_ledger_check_is_admin_only(make_user, client_as):
    alice = make_user("Alice")
    assert client_as(alice).get("/api/admin/ledger-check").status_code == 403
    assert client_as(alice).post("/api/admin/ledger-check").status_code == 403
