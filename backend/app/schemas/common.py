from datetime import UTC, datetime
from typing import Annotated

from pydantic import AfterValidator


def _as_utc(value: datetime) -> datetime:
    return value.replace(tzinfo=UTC) if value.tzinfo is None else value


# DateTime columns hold naive UTC. Marking them as UTC makes the JSON carry an
# offset ("...Z"), so browsers don't misread them as local time.
UtcDatetime = Annotated[datetime, AfterValidator(_as_utc)]
