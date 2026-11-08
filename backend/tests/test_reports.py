from datetime import datetime

import pytest

from app.models.transaction import Transaction

URL = "/api/admin/reports/purchases"
# Window: Thu 5.11. 18:00 -> Fri 6.11. 12:00 (UTC)
WINDOW = {"start": "2026-11-05T18:00:00Z", "end": "2026-11-06T12:00:00Z"}


@pytest.fixture
def setup(db, make_user, make_product, make_purchase):
    admin = make_user("Admin", is_admin=True)
    matti = make_user("Matti")
    liisa = make_user("Liisa")
    beer = make_product("Beer", 1.5, "🍺")
    lonkero = make_product("Lonkero", 2.0, "🍹")
    return {
        "admin": admin,
        "matti": matti,
        "liisa": liisa,
        "beer": beer,
        "lonkero": lonkero,
        "db": db,
        "purchase": make_purchase,
    }


def test_non_admin_is_forbidden(setup, client_as):
    resp = client_as(setup["matti"]).get(URL, params=WINDOW)
    assert resp.status_code == 403


def test_inactive_admin_is_forbidden(make_user, client_as):
    inactive_admin = make_user("Ghost", is_admin=True, is_active=False)
    resp = client_as(inactive_admin).get(URL, params=WINDOW)
    assert resp.status_code == 403


def test_sums_only_purchases_inside_window(setup, client_as):
    s = setup
    p = s["purchase"]
    p(s["matti"], s["beer"], 3, datetime(2026, 11, 5, 20, 0))
    p(s["matti"], s["lonkero"], 1, datetime(2026, 11, 5, 21, 0))
    p(s["liisa"], s["beer"], 2, datetime(2026, 11, 6, 1, 0))
    # start is inclusive
    p(s["liisa"], s["beer"], 1, datetime(2026, 11, 5, 18, 0))
    # outside the window: before start, and exactly at end (end is exclusive)
    p(s["matti"], s["beer"], 10, datetime(2026, 11, 5, 17, 59))
    p(s["matti"], s["beer"], 10, datetime(2026, 11, 6, 12, 0))
    # payment inside the window must be ignored
    s["db"].add(
        Transaction(
            user_id=s["matti"].id,
            type="payment",
            amount=50.0,
            status="approved",
            created_at=datetime(2026, 11, 5, 22, 0),
        )
    )
    s["db"].commit()

    body = client_as(s["admin"]).get(URL, params=WINDOW).json()

    assert body["total_items"] == 7
    assert body["total_amount"] == pytest.approx(11.0)
    assert body["user_count"] == 2

    assert [(r["product_name"], r["items"], r["amount"]) for r in body["by_product"]] == [
        ("Beer", 6, pytest.approx(9.0)),
        ("Lonkero", 1, pytest.approx(2.0)),
    ]
    assert body["by_product"][0]["emoji"] == "🍺"

    by_user = {u["user_name"]: u for u in body["by_user"]}
    assert [u["user_name"] for u in body["by_user"]] == ["Matti", "Liisa"]
    assert by_user["Matti"]["items"] == 4
    assert by_user["Matti"]["amount"] == pytest.approx(6.5)
    assert [(r["product_name"], r["items"]) for r in by_user["Matti"]["products"]] == [
        ("Beer", 3),
        ("Lonkero", 1),
    ]
    assert by_user["Liisa"]["items"] == 3
    assert by_user["Liisa"]["amount"] == pytest.approx(4.5)

    assert body["transaction_count"] == 4
    assert body["transactions_truncated"] is False
    times = [t["created_at"] for t in body["transactions"]]
    assert times == sorted(times, reverse=True)
    assert all(t["type"] == "purchase" for t in body["transactions"])


def test_rejected_excluded_by_default_pending_included(setup, client_as):
    s = setup
    p = s["purchase"]
    p(s["matti"], s["beer"], 1, datetime(2026, 11, 5, 20, 0), status="approved")
    p(s["matti"], s["beer"], 2, datetime(2026, 11, 5, 20, 5), status="pending")
    p(s["matti"], s["beer"], 4, datetime(2026, 11, 5, 20, 10), status="rejected")

    body = client_as(s["admin"]).get(URL, params=WINDOW).json()
    assert body["total_items"] == 3


def test_status_filter_can_select_rejected_only(setup, client_as):
    s = setup
    p = s["purchase"]
    p(s["matti"], s["beer"], 1, datetime(2026, 11, 5, 20, 0), status="approved")
    p(s["matti"], s["beer"], 4, datetime(2026, 11, 5, 20, 10), status="rejected")

    body = client_as(s["admin"]).get(URL, params={**WINDOW, "status": ["rejected"]}).json()
    assert body["total_items"] == 4


def test_amount_uses_charged_amount_not_current_price(setup, client_as):
    s = setup
    s["purchase"](s["matti"], s["beer"], 2, datetime(2026, 11, 5, 20, 0), amount=-2.0)
    s["beer"].price = 5.0
    s["db"].commit()

    body = client_as(s["admin"]).get(URL, params=WINDOW).json()
    assert body["total_amount"] == pytest.approx(2.0)


def test_timezone_offset_in_window_is_respected(setup, client_as):
    s = setup
    # 17:30 UTC == 19:30 Helsinki (UTC+2 in November)
    s["purchase"](s["matti"], s["beer"], 1, datetime(2026, 11, 5, 17, 30))

    params = {"start": "2026-11-05T19:00:00+02:00", "end": "2026-11-05T20:00:00+02:00"}
    body = client_as(s["admin"]).get(URL, params=params).json()
    assert body["total_items"] == 1


def test_empty_window_returns_zeroes(setup, client_as):
    body = client_as(setup["admin"]).get(URL, params=WINDOW).json()
    assert body["total_items"] == 0
    assert body["total_amount"] == 0
    assert body["user_count"] == 0
    assert body["by_product"] == []
    assert body["by_user"] == []
    assert body["transactions"] == []


def test_transaction_list_is_capped_but_totals_are_not(setup, client_as, monkeypatch):
    from app.services import reports

    monkeypatch.setattr(reports, "TRANSACTION_LIST_LIMIT", 2)
    s = setup
    for minute in range(3):
        s["purchase"](s["matti"], s["beer"], 1, datetime(2026, 11, 5, 20, minute))

    body = client_as(s["admin"]).get(URL, params=WINDOW).json()
    assert body["total_items"] == 3
    assert body["transaction_count"] == 3
    assert len(body["transactions"]) == 2
    assert body["transactions_truncated"] is True


def test_start_must_be_before_end(setup, client_as):
    params = {"start": WINDOW["end"], "end": WINDOW["start"]}
    resp = client_as(setup["admin"]).get(URL, params=params)
    assert resp.status_code == 400


@pytest.mark.parametrize(
    "bad_status",
    ["approved' OR '1'='1", "approved; DROP TABLE transactions;--", "APPROVED"],
)
def test_unknown_status_is_rejected(setup, client_as, bad_status):
    resp = client_as(setup["admin"]).get(URL, params={**WINDOW, "status": [bad_status]})
    assert resp.status_code == 422


@pytest.mark.parametrize("bad_time", ["yesterday", "2026-11-05' OR 1=1--", ""])
def test_malformed_time_is_rejected(setup, client_as, bad_time):
    resp = client_as(setup["admin"]).get(URL, params={**WINDOW, "start": bad_time})
    assert resp.status_code == 422


def test_names_with_sql_characters_are_returned_verbatim(db, make_user, make_product, make_purchase, client_as):
    admin = make_user("Admin", is_admin=True)
    sneaky = make_user("Robert'); DROP TABLE users;--")
    product = make_product("Beer' OR '1'='1", 1.0)
    make_purchase(sneaky, product, 1, datetime(2026, 11, 5, 20, 0))

    body = client_as(admin).get(URL, params=WINDOW).json()
    assert body["by_user"][0]["user_name"] == "Robert'); DROP TABLE users;--"
    assert body["by_product"][0]["product_name"] == "Beer' OR '1'='1"
