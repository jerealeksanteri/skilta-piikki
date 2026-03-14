from datetime import datetime
from pydantic import BaseModel


class SlotMachineSpinRequest(BaseModel):
    """Request schema for spinning the slot machine."""
    pass  # No input needed, always 1€ bet


class SlotMachineSpinResponse(BaseModel):
    """Response schema for a slot machine spin."""
    symbols: list[str]
    win_amount: float
    bet_amount: float
    new_balance: float


class SlotMachineHistory(BaseModel):
    """Schema for slot machine history."""
    id: int
    user_id: int
    bet_amount: float
    win_amount: float
    symbols: list[str]
    created_at: datetime

    class Config:
        from_attributes = True


class SlotMachineStats(BaseModel):
    """Schema for slot machine statistics."""
    total_spins: int
    total_bet: float
    total_won: float
    net_result: float
    biggest_win: float
