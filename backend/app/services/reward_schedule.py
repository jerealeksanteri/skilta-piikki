"""Date maths for recurring rewards.

A recurring reward has a fixed ``schedule_anchor``; occurrence ``n`` is the
anchor plus ``n`` periods. Computing every occurrence from the anchor (rather
than "previous run + 1 period") means the schedule never drifts, and a
monthly reward anchored on the 31st lands on the last day of shorter months
and returns to the 31st afterwards.

All datetimes are naive UTC, matching how the ``DateTime`` columns store them.
"""
import calendar
from datetime import datetime, timedelta, timezone

FREQUENCIES = ("daily", "weekly", "monthly", "yearly")


def utcnow() -> datetime:
    """Current UTC time as a naive datetime (the format the DB columns use)."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _add_months(anchor: datetime, months: int) -> datetime:
    total = anchor.month - 1 + months
    year = anchor.year + total // 12
    month = total % 12 + 1
    day = min(anchor.day, calendar.monthrange(year, month)[1])
    return anchor.replace(year=year, month=month, day=day)


def occurrence(anchor: datetime, frequency: str, n: int) -> datetime:
    """The n-th occurrence of the schedule (n=0 is the anchor itself)."""
    if frequency == "daily":
        return anchor + timedelta(days=n)
    if frequency == "weekly":
        return anchor + timedelta(weeks=n)
    if frequency == "monthly":
        return _add_months(anchor, n)
    if frequency == "yearly":
        return _add_months(anchor, 12 * n)
    raise ValueError(f"Invalid frequency: {frequency}")


def next_occurrence_after(anchor: datetime, frequency: str, after: datetime) -> datetime:
    """The first occurrence of the schedule strictly later than ``after``."""
    if frequency in ("daily", "weekly"):
        period = timedelta(days=1 if frequency == "daily" else 7)
        n = (after - anchor) // period
    elif frequency == "monthly":
        n = (after.year - anchor.year) * 12 + (after.month - anchor.month)
    elif frequency == "yearly":
        n = after.year - anchor.year
    else:
        raise ValueError(f"Invalid frequency: {frequency}")

    # The estimate is at most one period early; step forward to be exact.
    n = max(n, 0)
    candidate = occurrence(anchor, frequency, n)
    while candidate <= after:
        n += 1
        candidate = occurrence(anchor, frequency, n)
    return candidate
