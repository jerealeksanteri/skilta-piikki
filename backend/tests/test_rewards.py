import json
from datetime import datetime

import pytest
from sqlalchemy import text

from app.models.reward import Reward
from app.models.reward_grant import RewardGrant
from app.models.transaction import Transaction
from app.routers import rewards as rewards_router
from app.services import scheduler
from app.services.balance import adjust_balance
from app.services.reward_schedule import next_occurrence_after, occurrence


# --- Schedule maths ---------------------------------------------------------


def test_monthly_schedule_clamps_to_month_end_and_keeps_anchor_day():
    anchor = datetime(2026, 1, 31, 12)
    assert [occurrence(anchor, "monthly", n) for n in range(1, 4)] == [
        datetime(2026, 2, 28, 12),
        datetime(2026, 3, 31, 12),
        datetime(2026, 4, 30, 12),
    ]


def test_yearly_schedule_from_leap_day():
    anchor = datetime(2028, 2, 29, 9)
    assert occurrence(anchor, "yearly", 1) == datetime(2029, 2, 28, 9)
    assert occurrence(anchor, "yearly", 4) == datetime(2032, 2, 29, 9)


@pytest.mark.parametrize("frequency", ["daily", "weekly", "monthly", "yearly"])
def test_next_occurrence_is_strictly_after(frequency):
    anchor = datetime(2026, 1, 31, 12)
    nxt = next_occurrence_after(anchor, frequency, anchor)
    assert nxt > anchor
    assert next_occurrence_after(anchor, frequency, nxt) > nxt


def test_next_occurrence_skips_to_first_future_one():
    anchor = datetime(2026, 1, 31, 12)
    assert next_occurrence_after(anchor, "monthly", datetime(2026, 5, 2)) == datetime(2026, 5, 31, 12)


# --- Helpers ----------------------------------------------------------------


@pytest.fixture
def run_scheduler(db, monkeypatch):
    """Run the scheduler job against the test session at a fixed 'now'."""
    monkeypatch.setattr(db, "close", lambda: None)
    monkeypatch.setattr(scheduler, "SessionLocal", lambda: db)
    sent: list[tuple[str, dict]] = []

    def fake_bulk(_db, event_type, users_and_vars):
        sent.extend((u.first_name, v) for u, v in users_and_vars)
        return len(users_and_vars)

    monkeypatch.setattr("app.services.rewards.send_bulk_event_message", fake_bulk)

    def _run(now: datetime):
        monkeypatch.setattr(scheduler, "utcnow", lambda: now)
        scheduler.process_recurring_rewards()
        db.expire_all()
        return sent

    return _run


def _recurring(db, creator, *, frequency="monthly", anchor, next_grant, amount=5.0, users="[]"):
    reward = Reward(
        name="Monthly bonus",
        amount=amount,
        reward_type="recurring",
        recurrence_frequency=frequency,
        schedule_anchor=anchor,
        next_grant_date=next_grant,
        assigned_user_ids=users,
        created_by_id=creator.id,
    )
    db.add(reward)
    db.commit()
    return reward


# --- Scheduler --------------------------------------------------------------


def test_scheduler_grants_records_ledger_and_notifies_after_commit(db, make_user, run_scheduler):
    alice = make_user("Alice")
    reward = _recurring(db, alice, anchor=datetime(2026, 1, 31, 12), next_grant=datetime(2026, 3, 31, 12))

    sent = run_scheduler(datetime(2026, 3, 31, 13))

    assert alice.balance == 5.0
    grant = db.query(RewardGrant).one()
    assert grant.scheduled_for == datetime(2026, 3, 31, 12)
    assert grant.granted_by_scheduler is True
    tx = db.query(Transaction).one()
    assert (tx.type, tx.amount, tx.status, tx.user_id) == ("reward", 5.0, "approved", alice.id)
    assert grant.transaction_id == tx.id
    # Anchored on the 31st: the next one is Apr 30, not "now + 1 month".
    assert reward.next_grant_date == datetime(2026, 4, 30, 12)
    assert [name for name, _ in sent] == ["Alice"]


def test_scheduler_failure_rolls_back_and_sends_nothing(db, make_user, run_scheduler, monkeypatch):
    alice = make_user("Alice")
    reward = _recurring(db, alice, anchor=datetime(2026, 1, 1), next_grant=datetime(2026, 3, 1))

    def boom(*_a, **_k):
        raise RuntimeError("boom")

    monkeypatch.setattr(scheduler, "next_occurrence_after", boom)
    sent = run_scheduler(datetime(2026, 3, 1, 1))

    assert sent == []
    assert db.query(RewardGrant).count() == 0
    assert db.query(Transaction).count() == 0
    assert alice.balance == 0.0
    assert reward.next_grant_date == datetime(2026, 3, 1)


def test_scheduler_is_idempotent(db, make_user, run_scheduler):
    alice = make_user("Alice")
    _recurring(db, alice, anchor=datetime(2026, 1, 1), next_grant=datetime(2026, 3, 1))

    run_scheduler(datetime(2026, 3, 1, 1))
    run_scheduler(datetime(2026, 3, 1, 2))

    assert db.query(RewardGrant).count() == 1
    assert alice.balance == 5.0


def test_scheduler_skips_users_already_granted_for_that_occurrence(db, make_user, run_scheduler):
    alice, bob = make_user("Alice"), make_user("Bob")
    reward = _recurring(db, alice, anchor=datetime(2026, 1, 1), next_grant=datetime(2026, 3, 1))
    db.add(RewardGrant(reward_id=reward.id, user_id=alice.id, reward_name=reward.name,
                       amount=reward.amount, scheduled_for=datetime(2026, 3, 1),
                       granted_by_scheduler=True))
    db.commit()

    sent = run_scheduler(datetime(2026, 3, 1, 1))

    assert [name for name, _ in sent] == ["Bob"]
    assert db.query(RewardGrant).count() == 2
    assert alice.balance == 0.0 and bob.balance == 5.0


def test_scheduler_catches_up_missed_occurrences(db, make_user, run_scheduler):
    alice = make_user("Alice")
    reward = _recurring(db, alice, frequency="daily", anchor=datetime(2026, 3, 1, 9),
                        next_grant=datetime(2026, 3, 2, 9))

    run_scheduler(datetime(2026, 3, 4, 10))  # server was down for 3 occurrences

    days = sorted(g.scheduled_for.day for g in db.query(RewardGrant))
    assert days == [2, 3, 4]
    assert alice.balance == 15.0
    assert reward.next_grant_date == datetime(2026, 3, 5, 9)


def test_scheduler_only_grants_assigned_active_users(db, make_user, run_scheduler):
    alice, bob = make_user("Alice"), make_user("Bob")
    carol = make_user("Carol", is_active=False)
    _recurring(db, alice, anchor=datetime(2026, 1, 1), next_grant=datetime(2026, 3, 1),
               users=json.dumps([bob.id, carol.id]))

    run_scheduler(datetime(2026, 3, 1, 1))

    assert {g.user_id for g in db.query(RewardGrant)} == {bob.id}


# --- API --------------------------------------------------------------------


def test_create_monthly_reward_on_31st(make_user, client_as, monkeypatch):
    admin = make_user("Admin", is_admin=True)
    monkeypatch.setattr(rewards_router, "utcnow", lambda: datetime(2026, 1, 31, 12))

    r = client_as(admin).post("/api/rewards", json={
        "name": "Bonus", "amount": 2, "reward_type": "recurring",
        "recurrence_frequency": "monthly", "assigned_user_ids": [],
    })

    assert r.status_code == 200, r.text
    assert r.json()["next_grant_date"].startswith("2026-02-28T12:00:00")


def test_api_datetimes_are_utc_marked(make_user, client_as, monkeypatch):
    admin = make_user("Admin", is_admin=True)
    monkeypatch.setattr(rewards_router, "utcnow", lambda: datetime(2026, 3, 1, 12))
    r = client_as(admin).post("/api/rewards", json={
        "name": "Bonus", "amount": 2, "reward_type": "recurring",
        "recurrence_frequency": "daily", "assigned_user_ids": [],
    })
    body = r.json()
    for field in ("next_grant_date", "created_at", "updated_at"):
        assert body[field].endswith(("Z", "+00:00")), (field, body[field])


def test_list_grants_route_is_reachable(db, make_user, client_as):
    admin = make_user("Admin", is_admin=True)
    reward = Reward(name="One-off", amount=3, reward_type="one_time",
                    assigned_user_ids="[]", created_by_id=admin.id)
    db.add(reward)
    db.commit()
    client = client_as(admin)
    assert client.post("/api/rewards/grant",
                       json={"reward_id": reward.id, "user_ids": [admin.id]}).status_code == 200

    r = client.get("/api/rewards/grants?limit=50")

    assert r.status_code == 200, r.text
    assert len(r.json()) == 1
    assert r.json()[0]["granted_at"].endswith(("Z", "+00:00"))
    assert db.query(Transaction).filter(Transaction.type == "reward").count() == 1


def test_manual_grant_shows_in_users_transactions(db, make_user, client_as):
    admin = make_user("Admin", is_admin=True)
    alice = make_user("Alice")
    reward = Reward(name="Helper", amount=4, reward_type="one_time",
                    assigned_user_ids="[]", created_by_id=admin.id)
    db.add(reward)
    db.commit()
    client_as(admin).post("/api/rewards/grant", json={"reward_id": reward.id, "user_ids": [alice.id]})

    mine = client_as(alice).get("/api/transactions/mine").json()

    assert [(t["type"], t["amount"]) for t in mine] == [("reward", 4.0)]
    db.refresh(alice)
    assert alice.balance == 4.0


def test_reactivating_reward_skips_missed_periods(db, make_user, client_as, monkeypatch):
    admin = make_user("Admin", is_admin=True)
    reward = _recurring(db, admin, anchor=datetime(2026, 1, 15, 8), next_grant=datetime(2026, 2, 15, 8))
    reward.is_active = False
    db.commit()
    monkeypatch.setattr(rewards_router, "utcnow", lambda: datetime(2026, 6, 20))

    r = client_as(admin).put(f"/api/rewards/{reward.id}", json={"is_active": True})

    assert r.status_code == 200, r.text
    assert r.json()["next_grant_date"].startswith("2026-07-15T08:00:00")


# --- Balance ------------------------------------------------------------------


def test_adjust_balance_does_not_overwrite_concurrent_change(db, make_user):
    alice = make_user("Alice")
    assert alice.balance == 0.0  # loaded into this session
    # Another request changes the balance after we loaded it.
    db.execute(text("UPDATE users SET balance = 10 WHERE id = :id"), {"id": alice.id})

    adjust_balance(db, alice, 5.0)
    db.commit()

    assert alice.balance == 15.0


# --- Start date -----------------------------------------------------------------


def _create_recurring(client, **extra):
    return client.post("/api/rewards", json={
        "name": "Bonus", "amount": 2, "reward_type": "recurring",
        "recurrence_frequency": "monthly", "assigned_user_ids": [], **extra,
    })


def test_start_date_sets_first_grant_and_anchor(db, make_user, client_as, monkeypatch, run_scheduler):
    admin = make_user("Admin", is_admin=True)
    monkeypatch.setattr(rewards_router, "utcnow", lambda: datetime(2026, 1, 10, 12))

    # 18:00 Helsinki time (UTC+2) on Jan 31 = 16:00 UTC
    r = _create_recurring(client_as(admin), start_at="2026-01-31T18:00:00+02:00")

    assert r.status_code == 200, r.text
    assert r.json()["next_grant_date"].startswith("2026-01-31T16:00:00")
    run_scheduler(datetime(2026, 1, 31, 17))
    reward = db.query(Reward).one()
    assert [g.scheduled_for for g in db.query(RewardGrant)] == [datetime(2026, 1, 31, 16)]
    assert reward.next_grant_date == datetime(2026, 2, 28, 16)


def test_start_date_now_is_granted_on_next_run(make_user, client_as, monkeypatch):
    admin = make_user("Admin", is_admin=True)
    monkeypatch.setattr(rewards_router, "utcnow", lambda: datetime(2026, 3, 1, 12, 0, 30))

    r = _create_recurring(client_as(admin), start_at="2026-03-01T12:00:00Z")

    assert r.status_code == 200, r.text
    assert r.json()["next_grant_date"].startswith("2026-03-01T12:00:00")


def test_start_date_in_the_past_is_rejected(make_user, client_as, monkeypatch):
    admin = make_user("Admin", is_admin=True)
    monkeypatch.setattr(rewards_router, "utcnow", lambda: datetime(2026, 3, 1, 12))

    r = _create_recurring(client_as(admin), start_at="2026-02-28T12:00:00Z")

    assert r.status_code == 400


def test_start_date_not_allowed_for_one_time(make_user, client_as):
    admin = make_user("Admin", is_admin=True)
    r = client_as(admin).post("/api/rewards", json={
        "name": "Once", "amount": 2, "reward_type": "one_time",
        "assigned_user_ids": [], "start_at": "2030-01-01T00:00:00Z",
    })
    assert r.status_code == 400
