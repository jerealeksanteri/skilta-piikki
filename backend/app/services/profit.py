"""Revenue, cost and profit of purchases.

A purchase stores its product's cost per unit at the time (unit_cost). When
that was unknown the purchase is counted as "cost missing": it still adds to
revenue, but is left out of cost, profit and margin, so a missing cost never
looks like pure profit.
"""

from dataclasses import dataclass
from decimal import Decimal

from sqlalchemy import case, func

from app.models.transaction import Transaction
from app.money import ZERO, to_cents

_has_cost = Transaction.unit_cost.is_not(None)

# Aggregates to select next to a grouping; purchases are stored as negative amounts.
COST_COLUMNS = (
    func.coalesce(func.sum(case((_has_cost, -Transaction.amount), else_=0)), 0),  # revenue with a known cost
    func.coalesce(func.sum(case((_has_cost, Transaction.unit_cost * Transaction.quantity), else_=0)), 0),  # cost
    func.coalesce(func.sum(case((_has_cost, 0), else_=Transaction.quantity)), 0),  # items without a cost
)


@dataclass
class Profit:
    costed_revenue: Decimal = ZERO
    cost: Decimal = ZERO
    cost_missing_items: int = 0

    def add(self, costed_revenue, cost, missing_items) -> None:
        self.costed_revenue += to_cents(costed_revenue)
        self.cost += to_cents(cost)
        self.cost_missing_items += int(missing_items)

    @property
    def known(self) -> bool:
        """Whether any of these purchases had a cost price."""
        return self.costed_revenue != ZERO or self.cost != ZERO

    @property
    def profit(self) -> Decimal | None:
        return self.costed_revenue - self.cost if self.known else None

    @property
    def margin_pct(self) -> float | None:
        """Profit as a share of the revenue it's measured on, in percent."""
        if not self.known or self.costed_revenue == ZERO:
            return None
        return round(float((self.costed_revenue - self.cost) / self.costed_revenue * 100), 1)

    def fields(self) -> dict:
        return {
            "cost": self.cost if self.known else None,
            "profit": self.profit,
            "margin_pct": self.margin_pct,
            "cost_missing_items": self.cost_missing_items,
        }
