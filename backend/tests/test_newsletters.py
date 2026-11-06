from datetime import datetime

import pytest

from app.services import newsletters

URL = "/api/admin/newsletters"


@pytest.fixture
def sent(monkeypatch):
    """Capture outgoing Telegram messages instead of calling the API."""
    calls: list[dict] = []
    failing: set[int] = set()

    def fake_send(telegram_id, text, parse_mode=None):
        calls.append({"telegram_id": telegram_id, "text": text, "parse_mode": parse_mode})
        return telegram_id not in failing

    monkeypatch.setattr(newsletters, "send_message", fake_send)
    monkeypatch.setattr(newsletters, "SEND_DELAY_SECONDS", 0)
    return {"calls": calls, "failing": failing}


@pytest.fixture
def people(make_user):
    return {
        "admin": make_user("Admin", is_admin=True),
        "admin2": make_user("Admin2", is_admin=True),
        "matti": make_user("Matti"),
        "liisa": make_user("Liisa"),
        "pending": make_user("Pending", is_active=False),
        "pending_admin": make_user("PendingAdmin", is_admin=True, is_active=False),
    }


def payload(**overrides):
    body = {"audience": "everyone", "markup": "**Hello**", "html": "<b>Hello</b>"}
    body.update(overrides)
    return body


@pytest.mark.parametrize(
    "method,path",
    [("get", URL), ("get", f"{URL}/audiences"), ("post", URL)],
)
def test_non_admin_is_forbidden(people, client_as, sent, method, path):
    client = client_as(people["matti"])
    resp = client.post(path, json=payload()) if method == "post" else client.get(path)
    assert resp.status_code == 403
    assert sent["calls"] == []


def test_audience_counts_only_active_users(people, client_as):
    body = client_as(people["admin"]).get(f"{URL}/audiences").json()
    assert body == {"everyone": 4, "admins": 2}


def test_send_to_everyone_reaches_active_users_including_admins(people, client_as, sent):
    resp = client_as(people["admin"]).post(URL, json=payload())
    assert resp.status_code == 200

    recipients = {c["telegram_id"] for c in sent["calls"]}
    expected = {people[k].telegram_id for k in ("admin", "admin2", "matti", "liisa")}
    assert recipients == expected
    assert all(c["parse_mode"] == "HTML" for c in sent["calls"])
    assert all(c["text"] == "<b>Hello</b>" for c in sent["calls"])


def test_send_to_admins_only(people, client_as, sent):
    client_as(people["admin"]).post(URL, json=payload(audience="admins"))
    recipients = {c["telegram_id"] for c in sent["calls"]}
    assert recipients == {people["admin"].telegram_id, people["admin2"].telegram_id}


def test_sent_html_is_sanitized(people, client_as, sent):
    html = '<b onclick="x">Hi</b><script>bad()</script><a href="javascript:x">l</a>'
    client_as(people["admin"]).post(URL, json=payload(html=html))
    assert sent["calls"][0]["text"] == "<b>Hi</b>bad()l"


def test_result_reports_delivered_and_failed(people, client_as, sent):
    sent["failing"].add(people["liisa"].telegram_id)
    body = client_as(people["admin"]).post(URL, json=payload()).json()
    assert body["recipient_count"] == 4
    assert body["delivered_count"] == 3
    assert body["failed_count"] == 1
    assert body["audience"] == "everyone"
    assert body["created_by_name"] == "Admin"
    assert body["html"] == "<b>Hello</b>"
    assert body["markup"] == "**Hello**"


def test_log_lists_newsletters_newest_first(people, client_as, sent, db):
    client = client_as(people["admin"])
    client.post(URL, json=payload(markup="first", html="first"))
    client.post(URL, json=payload(markup="second", html="second", audience="admins"))

    # make ordering deterministic regardless of clock resolution
    from app.models.newsletter import Newsletter

    first, second = db.query(Newsletter).order_by(Newsletter.id).all()
    first.created_at = datetime(2026, 11, 1, 12, 0)
    second.created_at = datetime(2026, 11, 2, 12, 0)
    db.commit()

    log = client.get(URL).json()
    assert [n["html"] for n in log] == ["second", "first"]
    assert log[0]["audience"] == "admins"
    assert log[0]["recipient_count"] == 2


@pytest.mark.parametrize("html", ["", "   ", "<b> </b>", "<br><br>"])
def test_empty_message_is_rejected(people, client_as, sent, html):
    resp = client_as(people["admin"]).post(URL, json=payload(html=html))
    assert resp.status_code == 400
    assert sent["calls"] == []


def test_message_over_telegram_limit_is_rejected(people, client_as, sent):
    resp = client_as(people["admin"]).post(URL, json=payload(html="a" * 4097))
    assert resp.status_code == 400
    assert sent["calls"] == []


def test_message_at_telegram_limit_is_accepted(people, client_as, sent):
    resp = client_as(people["admin"]).post(URL, json=payload(html="<b>" + "a" * 4096 + "</b>"))
    assert resp.status_code == 200


@pytest.mark.parametrize("audience", ["all", "users", "everyone' OR '1'='1", ""])
def test_unknown_audience_is_rejected(people, client_as, sent, audience):
    resp = client_as(people["admin"]).post(URL, json=payload(audience=audience))
    assert resp.status_code == 422
    assert sent["calls"] == []
