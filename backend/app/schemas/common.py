from datetime import UTC, datetime
from decimal import Decimal
from typing import Annotated

from pydantic import AfterValidator, Field, PlainSerializer

from app.money import to_cents


def _as_utc(value: datetime) -> datetime:
    return value.replace(tzinfo=UTC) if value.tzinfo is None else value


# DateTime columns hold naive UTC. Marking them as UTC makes the JSON carry an
# offset ("...Z"), so browsers don't misread them as local time.
UtcDatetime = Annotated[datetime, AfterValidator(_as_utc)]

# Money is Decimal inside the backend but a plain JSON number in the API, so
# the frontend keeps working with numbers.
_as_json_number = PlainSerializer(float, return_type=float, when_used="json")

# Amounts sent in requests: at most 2 decimals, otherwise a 422 (no silent rounding).
MoneyIn = Annotated[Decimal, Field(max_digits=10, decimal_places=2), _as_json_number]

# Amounts in responses: rounded to the cent.
Money = Annotated[Decimal, AfterValidator(to_cents), _as_json_number]
