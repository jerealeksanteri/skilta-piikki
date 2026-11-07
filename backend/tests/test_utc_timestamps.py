import datetime as dt
import importlib
import pkgutil
import typing

from pydantic import BaseModel

import app.schemas
from app.database import _connect_args
from app.models.transaction import Transaction


def _plain_datetime_fields():
    """(model, field) pairs typed as a bare datetime, without UTC marking."""
    found = []
    for mod_info in pkgutil.iter_modules(app.schemas.__path__):
        module = importlib.import_module(f"app.schemas.{mod_info.name}")
        for obj in vars(module).values():
            if not (isinstance(obj, type) and issubclass(obj, BaseModel)) or obj.__module__ != module.__name__:
                continue
            for name, field in obj.model_fields.items():
                ann = field.annotation
                args = typing.get_args(ann) or (ann,)
                if dt.datetime in args and not field.metadata:
                    found.append(f"{obj.__name__}.{name}")
    return found


def test_every_schema_datetime_is_utc_marked():
    assert _plain_datetime_fields() == []


def test_transaction_times_are_sent_as_utc(db, make_user, client_as):
    alice = make_user("Alice")
    db.add(Transaction(user_id=alice.id, type="payment", amount=5, status="approved",
                       created_at=dt.datetime(2026, 11, 8, 10, 0)))
    db.commit()

    body = client_as(alice).get("/api/transactions/mine").json()

    assert body[0]["created_at"] in ("2026-11-08T10:00:00Z", "2026-11-08T10:00:00+00:00")


def test_postgres_sessions_use_utc():
    assert _connect_args("postgresql://u:p@db/piikki") == {"options": "-c timezone=UTC"}
    assert _connect_args("sqlite:///./x.db") == {}
