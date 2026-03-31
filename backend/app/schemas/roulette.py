from datetime import datetime
from pydantic import BaseModel


class RouletteBet(BaseModel):
    bet_type: str
    bet_value: str
    amount: float


class RouletteSpinRequest(BaseModel):
    bets: list[RouletteBet]


class RouletteBetResult(BaseModel):
    bet_type: str
    bet_value: str
    amount: float
    payout: float


class RouletteSpinResponse(BaseModel):
    number: int
    color: str
    results: list[RouletteBetResult]
    total_bet: float
    total_win: float
    new_balance: float


class RouletteHistory(BaseModel):
    id: int
    user_id: int
    bet_amount: float
    win_amount: float
    bet_data: list[RouletteBetResult]
    result_number: int
    result_color: str
    created_at: datetime

    class Config:
        from_attributes = True


class RouletteStats(BaseModel):
    total_spins: int
    total_bet: float
    total_won: float
    net_result: float
    biggest_win: float


class RouletteTopWinner(BaseModel):
    user_id: int
    user_name: str
    total_spins: int
    total_bet: float
    total_won: float
    net_result: float


class RouletteAdminStats(BaseModel):
    total_spins: int
    total_bet: float
    total_won: float
    house_profit: float
    actual_rtp: float
    theoretical_rtp: float
    top_winners: list[RouletteTopWinner]
    period_start: datetime | None
    period_end: datetime | None
    enabled: bool


class RouletteStatusResponse(BaseModel):
    enabled: bool


class RouletteToggleRequest(BaseModel):
    enabled: bool
