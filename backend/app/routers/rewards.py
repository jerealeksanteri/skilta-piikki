import json
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth.telegram import require_admin
from app.database import get_db
from app.models.reward import Reward
from app.models.reward_grant import RewardGrant
from app.models.user import User
from app.schemas.reward import (
    RewardCreate,
    RewardUpdate,
    RewardOut,
    RewardGrantOut,
    GrantRewardRequest,
)
from app.services.reports import to_naive_utc
from app.services.reward_schedule import next_occurrence_after, utcnow
from app.services.rewards import RewardService

router = APIRouter()

# A start date chosen as "now" in the UI reaches the server a moment later.
START_AT_TOLERANCE = timedelta(minutes=5)


def _start_schedule(reward: Reward, frequency: str) -> None:
    """(Re)start the schedule from now: the first grant is one period away."""
    now = utcnow()
    reward.schedule_anchor = now
    reward.next_grant_date = next_occurrence_after(now, frequency, now)


def _reward_to_out(reward: Reward) -> RewardOut:
    """Convert Reward model to RewardOut schema"""
    user_ids = json.loads(reward.assigned_user_ids)
    return RewardOut(
        id=reward.id,
        name=reward.name,
        description=reward.description,
        amount=reward.amount,
        reward_type=reward.reward_type,
        recurrence_frequency=reward.recurrence_frequency,
        assigned_user_ids=user_ids,
        is_active=reward.is_active,
        next_grant_date=reward.next_grant_date,
        created_by_id=reward.created_by_id,
        created_at=reward.created_at,
        updated_at=reward.updated_at,
    )


def _grant_to_out(grant: RewardGrant) -> RewardGrantOut:
    """Convert RewardGrant model to RewardGrantOut schema"""
    return RewardGrantOut(
        id=grant.id,
        reward_id=grant.reward_id,
        user_id=grant.user_id,
        user_name=grant.user.first_name if grant.user else None,
        reward_name=grant.reward_name,
        amount=grant.amount,
        note=grant.note,
        granted_at=grant.granted_at,
        granted_by_scheduler=grant.granted_by_scheduler,
        scheduled_for=grant.scheduled_for,
    )


# === Grant Endpoints ===
# Declared before /rewards/{reward_id} so "grants" is not parsed as a reward id.

@router.post("/rewards/grant", response_model=list[RewardGrantOut])
def grant_reward_manually(
    data: GrantRewardRequest,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Manually grant a one-time reward to specific users"""
    reward = db.query(Reward).filter(Reward.id == data.reward_id, Reward.is_active == True).first()
    if not reward:
        raise HTTPException(status_code=404, detail="Reward not found or inactive")

    if reward.reward_type != "one_time":
        raise HTTPException(status_code=400, detail="Can only manually grant one-time rewards")

    # Validate users exist
    users = db.query(User).filter(User.id.in_(data.user_ids), User.is_active == True).all()
    if len(users) != len(set(data.user_ids)):
        raise HTTPException(status_code=400, detail="One or more users not found or inactive")

    grants = RewardService.grant(
        db,
        reward,
        users,
        granted_by_scheduler=False,
        note=data.note,
        created_by_id=admin.id,
    )
    db.commit()

    RewardService.notify(db, grants)
    return [_grant_to_out(g) for g in grants]


@router.get("/rewards/grants", response_model=list[RewardGrantOut])
def list_all_grants(
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
    limit: int = 100,
):
    """List recent reward grants (admin view)"""
    grants = (
        db.query(RewardGrant)
        .order_by(RewardGrant.granted_at.desc())
        .limit(limit)
        .all()
    )
    return [_grant_to_out(g) for g in grants]


@router.get("/rewards/grants/user/{user_id}", response_model=list[RewardGrantOut])
def list_user_grants(
    user_id: int,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """List all grants for a specific user"""
    grants = (
        db.query(RewardGrant)
        .filter(RewardGrant.user_id == user_id)
        .order_by(RewardGrant.granted_at.desc())
        .all()
    )
    return [_grant_to_out(g) for g in grants]


# === Reward CRUD Endpoints ===

@router.get("/rewards", response_model=list[RewardOut])
def list_rewards(
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """List all rewards (active and inactive)"""
    rewards = db.query(Reward).order_by(Reward.created_at.desc()).all()
    return [_reward_to_out(r) for r in rewards]


@router.get("/rewards/{reward_id}", response_model=RewardOut)
def get_reward(
    reward_id: int,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Get single reward by ID"""
    reward = db.query(Reward).filter(Reward.id == reward_id).first()
    if not reward:
        raise HTTPException(status_code=404, detail="Reward not found")
    return _reward_to_out(reward)


@router.post("/rewards", response_model=RewardOut)
def create_reward(
    data: RewardCreate,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Create a new reward"""
    # Validation
    if data.reward_type == "recurring" and not data.recurrence_frequency:
        raise HTTPException(status_code=400, detail="recurrence_frequency required for recurring rewards")
    if data.reward_type == "one_time" and data.recurrence_frequency:
        raise HTTPException(status_code=400, detail="recurrence_frequency not allowed for one-time rewards")
    if data.reward_type == "one_time" and data.start_at:
        raise HTTPException(status_code=400, detail="start_at is only for recurring rewards")
    start_at = to_naive_utc(data.start_at) if data.start_at else None
    if start_at and start_at < utcnow() - START_AT_TOLERANCE:
        raise HTTPException(status_code=400, detail="Start date can't be in the past")

    # Validate user IDs exist if specific users assigned
    if data.assigned_user_ids:
        user_count = db.query(User).filter(User.id.in_(data.assigned_user_ids)).count()
        if user_count != len(set(data.assigned_user_ids)):
            raise HTTPException(status_code=400, detail="One or more user IDs not found")

    reward = Reward(
        name=data.name,
        description=data.description,
        amount=data.amount,
        reward_type=data.reward_type,
        recurrence_frequency=data.recurrence_frequency,
        assigned_user_ids=json.dumps(data.assigned_user_ids),
        created_by_id=admin.id,
    )
    if start_at:
        # The first grant is at start_at itself; later ones repeat from it.
        reward.schedule_anchor = start_at
        reward.next_grant_date = start_at
    elif data.reward_type == "recurring":
        _start_schedule(reward, data.recurrence_frequency)
    db.add(reward)
    db.commit()
    db.refresh(reward)
    return _reward_to_out(reward)


@router.put("/rewards/{reward_id}", response_model=RewardOut)
def update_reward(
    reward_id: int,
    data: RewardUpdate,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Update an existing reward"""
    reward = db.query(Reward).filter(Reward.id == reward_id).first()
    if not reward:
        raise HTTPException(status_code=404, detail="Reward not found")

    if data.recurrence_frequency is not None and reward.reward_type != "recurring":
        raise HTTPException(status_code=400, detail="Cannot set recurrence_frequency on one-time reward")
    if data.assigned_user_ids:
        user_count = db.query(User).filter(User.id.in_(data.assigned_user_ids)).count()
        if user_count != len(set(data.assigned_user_ids)):
            raise HTTPException(status_code=400, detail="One or more user IDs not found")

    if data.name is not None:
        reward.name = data.name
    if data.description is not None:
        reward.description = data.description
    if data.amount is not None:
        reward.amount = data.amount
    if data.assigned_user_ids is not None:
        reward.assigned_user_ids = json.dumps(data.assigned_user_ids)

    if (
        data.recurrence_frequency is not None
        and data.recurrence_frequency != reward.recurrence_frequency
    ):
        reward.recurrence_frequency = data.recurrence_frequency
        _start_schedule(reward, data.recurrence_frequency)

    if data.is_active is not None:
        reactivating = data.is_active and not reward.is_active
        reward.is_active = data.is_active
        if reactivating and reward.reward_type == "recurring":
            # Don't pay out the periods it was switched off for: continue
            # the same schedule from the next future occurrence.
            if reward.schedule_anchor is None:
                _start_schedule(reward, reward.recurrence_frequency)
            else:
                reward.next_grant_date = next_occurrence_after(
                    reward.schedule_anchor, reward.recurrence_frequency, utcnow()
                )

    db.commit()
    db.refresh(reward)
    return _reward_to_out(reward)


@router.delete("/rewards/{reward_id}", response_model=RewardOut)
def delete_reward(
    reward_id: int,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Soft delete (deactivate) a reward"""
    reward = db.query(Reward).filter(Reward.id == reward_id).first()
    if not reward:
        raise HTTPException(status_code=404, detail="Reward not found")

    reward.is_active = False
    db.commit()
    db.refresh(reward)
    return _reward_to_out(reward)
