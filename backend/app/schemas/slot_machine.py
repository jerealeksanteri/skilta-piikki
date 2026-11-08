from pydantic import BaseModel

from app.schemas.common import Money, UtcDatetime


class SlotMachineSpinRequest(BaseModel):
    """Request schema for spinning the slot machine."""

    pass  # No input needed, always 1€ bet


class SlotMachineSpinResponse(BaseModel):
    """Response schema for a slot machine spin."""

    symbols: list[str]
    win_amount: Money
    bet_amount: Money
    new_balance: Money


class SlotMachineHistory(BaseModel):
    """Schema for slot machine history."""

    id: int
    user_id: int
    bet_amount: Money
    win_amount: Money
    symbols: list[str]
    created_at: UtcDatetime

    class Config:
        from_attributes = True


class SlotMachineStats(BaseModel):
    """Schema for slot machine statistics."""

    total_spins: int
    total_bet: Money
    total_won: Money
    net_result: Money
    biggest_win: Money
    theoretical_rtp: float


class SlotMachineTopWinner(BaseModel):
    """Schema for a top winner entry."""

    user_id: int
    user_name: str
    total_spins: int
    total_bet: Money
    total_won: Money
    net_result: Money


class SlotMachineAdminStats(BaseModel):
    """Schema for admin slot machine statistics."""

    total_spins: int
    total_bet: Money
    total_won: Money
    house_profit: Money
    actual_rtp: float
    theoretical_rtp: float
    top_winners: list[SlotMachineTopWinner]
    period_start: UtcDatetime | None
    period_end: UtcDatetime | None
    enabled: bool


class SlotMachineStatusResponse(BaseModel):
    """Schema for slot machine status."""

    enabled: bool


class SlotMachineToggleRequest(BaseModel):
    """Schema for toggling slot machine."""

    enabled: bool
