"""Money is stored as NUMERIC(10, 2) and handled as Decimal, never float."""

from decimal import ROUND_HALF_UP, Decimal

CENT = Decimal("0.01")
ZERO = Decimal("0.00")


def to_cents(value: Decimal | int | float | str) -> Decimal:
    """Round to whole cents (half up). Floats go through str() so 0.1 stays 0.1."""
    if isinstance(value, float):
        value = str(value)
    return Decimal(value).quantize(CENT, rounding=ROUND_HALF_UP)
