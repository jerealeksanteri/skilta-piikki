from typing import Literal

from pydantic import BaseModel, Field, field_validator

from app.schemas.common import UtcDatetime


class RewardBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: str | None = None
    amount: float = Field(..., gt=0)
    reward_type: str  # 'one_time' or 'recurring'
    recurrence_frequency: str | None = None  # 'daily', 'weekly', 'monthly', 'yearly'
    assigned_user_ids: list[int]  # Empty list means all users

    @field_validator("reward_type")
    @classmethod
    def validate_reward_type(cls, v: str) -> str:
        if v not in ["one_time", "recurring"]:
            raise ValueError("reward_type must be 'one_time' or 'recurring'")
        return v

    @field_validator("recurrence_frequency")
    @classmethod
    def validate_recurrence_frequency(cls, v: str | None) -> str | None:
        if v is not None and v not in ["daily", "weekly", "monthly", "yearly"]:
            raise ValueError("recurrence_frequency must be 'daily', 'weekly', 'monthly', or 'yearly'")
        return v


class RewardCreate(RewardBase):
    # Recurring only: when the first grant happens; later grants repeat from
    # it. Omitted = one period from now. Naive values are treated as UTC.
    start_at: UtcDatetime | None = None


class RewardUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    amount: float | None = Field(None, gt=0)
    recurrence_frequency: str | None = None
    assigned_user_ids: list[int] | None = None
    is_active: bool | None = None


class RewardOut(RewardBase):
    id: int
    is_active: bool
    next_grant_date: UtcDatetime | None
    created_by_id: int
    created_at: UtcDatetime
    updated_at: UtcDatetime

    model_config = {"from_attributes": True}


class RewardGrantOut(BaseModel):
    id: int
    reward_id: int
    user_id: int
    user_name: str | None
    reward_name: str
    amount: float
    note: str | None
    granted_at: UtcDatetime
    scheduled_for: UtcDatetime | None = None
    granted_by_scheduler: bool

    model_config = {"from_attributes": True}


class GrantRewardRequest(BaseModel):
    """Manual grant request for one-time reward"""
    reward_id: int
    user_ids: list[int] = Field(..., min_length=1)
    note: str | None = None


class SchedulerStatusOut(BaseModel):
    """Health of the recurring-reward scheduler, for the admin page.

    state: 'ok' (ran recently without errors), 'failing' (last run had
    rewards that errored), 'stale' (no run for over 2 hours) or 'never'.
    """
    state: Literal["ok", "failing", "stale", "never"]
    last_run_at: UtcDatetime | None
    next_run_at: UtcDatetime | None
    due_rewards: int = 0
    occurrences_granted: int = 0
    failed_reward_ids: list[int] = []
