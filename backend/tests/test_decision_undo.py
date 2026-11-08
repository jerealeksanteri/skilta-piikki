from datetime import datetime, timedelta
from decimal import Decimal

import pytest

from app.models.audit_log import AuditLog
from app.models.message_template import MessageTemplate
from app.models.transaction import Transaction
from app.services import decisions, ledger

START = datetime(2026, 11, 9, 18, 0, 0)


@pytest.fixture
def clock(monkeypatch):
    state = {"now": START}
    monkeypatch.setattr(decisions, "now", lambda: state["now"])

    class Clock:
        def advance(self, seconds: float) -> None:
            state["now"] += timedelta(seconds=seconds)

    return Clock()


@pytest.fixture
def outbox(db, monkeypatch):
    """Messages the bot would send, as (telegram_id, text)."""
    for event, text in (
        ("payment_approved", "{user}: +{amount} €"),
        ("payment_rejected", "{user}: rejected {amount} €"),
    ):
        db.add(MessageTemplate(event_type=event, template=text, is_active=True))
    db.commit()
    sent = []
    monkeypatch.setattr(
        "app.services.messaging.send_message", lambda chat_id, text, **_: sent.append((chat_id, text)) or True
    )
    return sent


@pytest.fixture
def people(make_user):
    return make_user("Admin", is_admin=True), make_user("Alice")


def _request_payment(client, amount="10.00"):
    r = client.post("/api/transactions/payment-request", json={"amount": amount})
    assert r.status_code == 200, r.text
    return r.json()["id"]


def test_approve_applies_at_once_and_holds_the_message(db, client_as, clock, outbox, people):
    admin, alice = people
    tx_id = _request_payment(client_as(alice))

    r = client_as(admin).put(f"/api/transactions/{tx_id}/approve")

    assert r.json()["decision_remaining_ms"] == 60_000
    assert r.json()["approved_by_name"] == "Admin"
    db.refresh(alice)
    assert alice.balance == Decimal("10.00")
    assert decisions.send_due_notices(db) == 0
    assert outbox == []

    clock.advance(60)
    assert decisions.send_due_notices(db) == 1
    assert outbox == [(alice.telegram_id, "Alice: +10.00 €")]
    assert decisions.send_due_notices(db) == 0  # sent once only


def test_undo_puts_it_back_and_nothing_is_announced(db, client_as, clock, outbox, people):
    admin, alice = people
    tx_id = _request_payment(client_as(alice))
    client_as(admin).put(f"/api/transactions/{tx_id}/approve")
    clock.advance(30)

    r = client_as(admin).put(f"/api/transactions/{tx_id}/undo-decision")

    assert r.status_code == 200, r.text
    assert r.json()["status"] == "pending"
    db.refresh(alice)
    assert alice.balance == Decimal("0.00")
    assert [t["id"] for t in client_as(admin).get("/api/transactions/pending").json()] == [tx_id]
    clock.advance(60)
    assert decisions.send_due_notices(db) == 0
    assert outbox == []
    assert ledger.find_mismatches(db)[1] == []
    actions = [a.action for a in db.query(AuditLog).order_by(AuditLog.id)]
    assert actions == ["transaction.approve", "transaction.undo_decision"]


def test_undo_then_decide_again(db, client_as, clock, outbox, people):
    admin, alice = people
    tx_id = _request_payment(client_as(alice))
    client_as(admin).put(f"/api/transactions/{tx_id}/approve")
    client_as(admin).put(f"/api/transactions/{tx_id}/undo-decision")

    client_as(admin).put(f"/api/transactions/{tx_id}/reject")
    clock.advance(61)
    decisions.send_due_notices(db)

    assert outbox == [(alice.telegram_id, "Alice: rejected 10.00 €")]
    db.refresh(alice)
    assert alice.balance == Decimal("0.00")


def test_window_closes_after_grace(client_as, clock, outbox, people):
    admin, alice = people
    tx_id = _request_payment(client_as(alice))
    client_as(admin).put(f"/api/transactions/{tx_id}/reject")

    clock.advance(66)

    assert client_as(admin).put(f"/api/transactions/{tx_id}/undo-decision").status_code == 409


def test_recently_decided_lists_open_windows(client_as, clock, outbox, people):
    admin, alice = people
    first = _request_payment(client_as(alice))
    second = _request_payment(client_as(alice), "5.00")
    client_as(admin).put(f"/api/transactions/{first}/approve")
    clock.advance(30)
    client_as(admin).put(f"/api/transactions/{second}/reject")

    assert [t["id"] for t in client_as(admin).get("/api/transactions/recently-decided").json()] == [second, first]
    clock.advance(31)
    assert [t["id"] for t in client_as(admin).get("/api/transactions/recently-decided").json()] == [second]


def test_notice_after_restart_is_still_sent(db, client_as, clock, outbox, people):
    """A message held when the backend stopped goes out on the job's next run."""
    admin, alice = people
    tx_id = _request_payment(client_as(alice))
    client_as(admin).put(f"/api/transactions/{tx_id}/approve")
    clock.advance(3600)  # the backend was down for an hour

    assert decisions.send_due_notices(db) == 1


def test_purchases_get_the_window_but_no_message(db, client_as, clock, outbox, people, make_product, monkeypatch):
    from app.config import settings

    monkeypatch.setattr(settings, "AUTO_APPROVE_PURCHASES", False)
    admin, alice = people
    beer = make_product("Beer", Decimal("2.00"))
    tx_id = client_as(alice).post("/api/transactions/purchase", json={"product_id": beer.id}).json()["id"]

    client_as(admin).put(f"/api/transactions/{tx_id}/approve")
    clock.advance(61)

    assert db.get(Transaction, tx_id).notice_pending is False
    assert decisions.send_due_notices(db) == 0


def test_undo_is_admin_only(client_as, clock, outbox, people):
    admin, alice = people
    tx_id = _request_payment(client_as(alice))
    client_as(admin).put(f"/api/transactions/{tx_id}/approve")

    assert client_as(alice).put(f"/api/transactions/{tx_id}/undo-decision").status_code == 403
    assert client_as(alice).get("/api/transactions/recently-decided").status_code == 403


def test_finish_sends_at_once_and_ends_the_window(db, client_as, clock, outbox, people):
    admin, alice = people
    tx_id = _request_payment(client_as(alice))
    client_as(admin).put(f"/api/transactions/{tx_id}/approve")
    clock.advance(5)

    r = client_as(admin).put(f"/api/transactions/{tx_id}/finish-decision")

    assert r.status_code == 200, r.text
    assert (r.json()["status"], r.json()["decision_remaining_ms"]) == ("approved", None)
    assert outbox == [(alice.telegram_id, "Alice: +10.00 €")]
    assert client_as(admin).get("/api/transactions/recently-decided").json() == []
    assert client_as(admin).put(f"/api/transactions/{tx_id}/undo-decision").status_code == 409
    clock.advance(120)
    assert decisions.send_due_notices(db) == 0  # not sent a second time
    assert len(outbox) == 1


def test_finish_without_a_message_is_fine(client_as, clock, outbox, people, make_product, monkeypatch):
    from app.config import settings

    monkeypatch.setattr(settings, "AUTO_APPROVE_PURCHASES", False)
    admin, alice = people
    beer = make_product("Beer", Decimal("2.00"))
    tx_id = client_as(alice).post("/api/transactions/purchase", json={"product_id": beer.id}).json()["id"]
    client_as(admin).put(f"/api/transactions/{tx_id}/reject")

    assert client_as(admin).put(f"/api/transactions/{tx_id}/finish-decision").status_code == 200
    assert outbox == []
