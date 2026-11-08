import json
from datetime import datetime
from decimal import Decimal

from app.models.audit_log import AuditLog
from app.models.fiscal_period import FiscalPeriod
from app.models.transaction import Transaction
from app.services.audit import record


def _entries(db, action=None):
    query = db.query(AuditLog).order_by(AuditLog.id)
    if action:
        query = query.filter(AuditLog.action == action)
    return query.all()


def test_product_update_records_only_changed_fields(db, make_user, make_product, client_as):
    admin = make_user("Admin", is_admin=True)
    beer = make_product("Beer", Decimal("1.00"))

    client_as(admin).put(f"/api/products/{beer.id}", json={"price": 1.2, "name": "Beer"})

    (entry,) = _entries(db, "product.update")
    assert (entry.actor_name, entry.target_type, entry.target_id, entry.target_label) == (
        "Admin",
        "products",
        beer.id,
        "Beer",
    )
    # Money is stored exactly; the unchanged name isn't listed.
    assert json.loads(entry.changes) == {"price": {"from": "1.00", "to": "1.20"}}


def test_no_entry_when_nothing_changed(db, make_user, make_product, client_as):
    admin = make_user("Admin", is_admin=True)
    beer = make_product("Beer", Decimal("1.00"))

    client_as(admin).put(f"/api/products/{beer.id}", json={"price": 1.0})

    assert _entries(db, "product.update") == []


def test_transaction_approval_and_rejection(db, make_user, client_as):
    admin = make_user("Admin", is_admin=True)
    alice = make_user("Alice")
    client = client_as(admin)
    first = client.post("/api/transactions/payment", json={"user_id": alice.id, "amount": 5}).json()
    second = client.post("/api/transactions/payment", json={"user_id": alice.id, "amount": 2.5}).json()

    client.put(f"/api/transactions/{first['id']}/approve")
    client.put(f"/api/transactions/{second['id']}/reject")

    assert [e.action for e in _entries(db)] == [
        "payment.create",
        "payment.create",
        "transaction.approve",
        "transaction.reject",
    ]
    approve = _entries(db, "transaction.approve")[0]
    assert approve.target_label == "Payment 5.00 € · Alice"
    assert json.loads(approve.changes) == {"status": {"from": "pending", "to": "approved"}}


def test_user_role_changes(db, make_user, client_as):
    admin = make_user("Admin", is_admin=True)
    bob = make_user("Bob")
    client = client_as(admin)

    client.put(f"/api/users/{bob.id}/promote")
    client.put(f"/api/users/{bob.id}/demote")
    client.put(f"/api/users/{bob.id}/deactivate")

    assert [(e.action, json.loads(e.changes)) for e in _entries(db)] == [
        ("user.promote", {"is_admin": {"from": False, "to": True}}),
        ("user.demote", {"is_admin": {"from": True, "to": False}}),
        ("user.deactivate", {"is_active": {"from": True, "to": False}}),
    ]


def test_denied_user_stays_readable_in_the_log(db, make_user, client_as):
    admin = make_user("Admin", is_admin=True)
    pending = make_user("Pekka", is_active=False)

    client_as(admin).delete(f"/api/users/{pending.id}/deny")

    (entry,) = _entries(db, "user.deny")
    assert (entry.target_id, entry.target_label) == (pending.id, "Pekka")


def test_fiscal_close_and_slot_toggle(db, make_user, make_product, make_purchase, client_as):
    admin = make_user("Admin", is_admin=True)
    alice = make_user("Alice")
    beer = make_product("Beer", Decimal("2.00"))
    make_purchase(alice, beer, 3, datetime(2026, 11, 8))
    alice.balance = Decimal("-6.00")
    db.add(FiscalPeriod(started_at=datetime(2026, 9, 1)))
    db.commit()
    client = client_as(admin)

    assert client.post("/api/fiscal-periods/close").status_code == 200
    client.put("/api/slot-machine/admin/toggle", json={"enabled": False})

    (close,) = _entries(db, "fiscal_period.close")
    assert close.target_label == "Period from 01.09.2026"
    assert close.note == "1 debts created (6.00 €); negative balances reset to 0"
    (toggle,) = _entries(db, "slot_machine.toggle")
    assert json.loads(toggle.changes) == {"enabled": {"from": True, "to": False}}


def test_rolled_back_change_leaves_no_entry(db, make_user):
    admin = make_user("Admin", is_admin=True)

    record(db, admin, "product.update", note="never committed")
    db.rollback()

    assert _entries(db) == []


def test_list_filters_and_pages(db, make_user, make_product, client_as):
    admin = make_user("Admin", is_admin=True)
    other = make_user("Other", is_admin=True)
    beer = make_product("Beer", Decimal("1.00"))
    for price in (1.1, 1.2, 1.3):
        client_as(admin).put(f"/api/products/{beer.id}", json={"price": price})
    client_as(other).put(f"/api/users/{admin.id}/promote")
    client = client_as(admin)

    page = client.get("/api/admin/audit-log", params={"limit": 2}).json()
    assert [e["action"] for e in page["entries"]] == ["user.promote", "product.update"]  # newest first
    assert page["has_more"] is True
    rest = client.get("/api/admin/audit-log", params={"limit": 2, "before_id": page["entries"][-1]["id"]}).json()
    assert len(rest["entries"]) == 2 and rest["has_more"] is False

    by_category = client.get("/api/admin/audit-log", params={"action": "product"}).json()["entries"]
    assert len(by_category) == 3
    assert by_category[0]["changes"] == {"price": {"from": "1.20", "to": "1.30"}}
    by_actor = client.get("/api/admin/audit-log", params={"actor_id": other.id}).json()["entries"]
    assert [e["action"] for e in by_actor] == ["user.promote"]

    filters = client.get("/api/admin/audit-log/filters").json()
    assert filters == {
        "actors": [{"id": admin.id, "name": "Admin"}, {"id": other.id, "name": "Other"}],
        "actions": ["product.update", "user.promote"],
    }


def test_audit_log_is_admin_only(make_user, client_as):
    alice = make_user("Alice")
    assert client_as(alice).get("/api/admin/audit-log").status_code == 403


def test_rejection_of_purchase_is_logged_with_member_name(db, make_user, make_product, client_as):
    admin = make_user("Admin", is_admin=True)
    alice = make_user("Alice")
    beer = make_product("Beer", Decimal("1.50"))
    tx = Transaction(user_id=alice.id, product_id=beer.id, type="purchase", amount=Decimal("-1.50"), status="pending")
    db.add(tx)
    db.commit()

    client_as(admin).put(f"/api/transactions/{tx.id}/reject")

    assert _entries(db, "transaction.reject")[0].target_label == "Purchase -1.50 € · Alice"
