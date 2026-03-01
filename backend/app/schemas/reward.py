from datetime import datetime
from pydantic import BaseModel, Field, field_validator


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
    pass


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
    next_grant_date: datetime | None
    created_by_id: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class RewardGrantOut(BaseModel):
    id: int
    reward_id: int
    user_id: int
    user_name: str | None
    reward_name: str
    amount: float
    note: str | None
    granted_at: datetime
    granted_by_scheduler: bool

    model_config = {"from_attributes": True}


class GrantRewardRequest(BaseModel):
    """Manual grant request for one-time reward"""
    reward_id: int
    user_ids: list[int] = Field(..., min_length=1)
    note: str | None = None
