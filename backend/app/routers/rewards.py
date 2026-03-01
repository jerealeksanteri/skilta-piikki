import json
from datetime import datetime, timezone, timedelta
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
from app.services.messaging import send_event_message

router = APIRouter()


def _calculate_next_grant_date(frequency: str) -> datetime:
    """Calculate next grant date based on frequency"""
    now = datetime.now(timezone.utc)
    if frequency == "daily":
        return now + timedelta(days=1)
    elif frequency == "weekly":
        return now + timedelta(weeks=1)
    elif frequency == "monthly":
        # More accurate monthly calculation
        if now.month == 12:
            return now.replace(year=now.year + 1, month=1)
        else:
            return now.replace(month=now.month + 1)
    elif frequency == "yearly":
        return now.replace(year=now.year + 1)
    raise ValueError(f"Invalid frequency: {frequency}")


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
    )


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

    # Validate user IDs exist if specific users assigned
    if data.assigned_user_ids:
        user_count = db.query(User).filter(User.id.in_(data.assigned_user_ids)).count()
        if user_count != len(data.assigned_user_ids):
            raise HTTPException(status_code=400, detail="One or more user IDs not found")

    # Calculate next grant date for recurring rewards
    next_grant_date = None
    if data.reward_type == "recurring":
        next_grant_date = _calculate_next_grant_date(data.recurrence_frequency)

    reward = Reward(
        name=data.name,
        description=data.description,
        amount=data.amount,
        reward_type=data.reward_type,
        recurrence_frequency=data.recurrence_frequency,
        next_grant_date=next_grant_date,
        assigned_user_ids=json.dumps(data.assigned_user_ids),
        created_by_id=admin.id,
    )
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

    if data.name is not None:
        reward.name = data.name
    if data.description is not None:
        reward.description = data.description
    if data.amount is not None:
        reward.amount = data.amount
    if data.recurrence_frequency is not None:
        if reward.reward_type != "recurring":
            raise HTTPException(status_code=400, detail="Cannot set recurrence_frequency on one-time reward")
        reward.recurrence_frequency = data.recurrence_frequency
        reward.next_grant_date = _calculate_next_grant_date(data.recurrence_frequency)
    if data.assigned_user_ids is not None:
        if data.assigned_user_ids:
            user_count = db.query(User).filter(User.id.in_(data.assigned_user_ids)).count()
            if user_count != len(data.assigned_user_ids):
                raise HTTPException(status_code=400, detail="One or more user IDs not found")
        reward.assigned_user_ids = json.dumps(data.assigned_user_ids)
    if data.is_active is not None:
        reward.is_active = data.is_active

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


# === Grant Endpoints ===

@router.post("/rewards/grant", response_model=list[RewardGrantOut])
def grant_reward_manually(
    data: GrantRewardRequest,
    _admin: User = Depends(require_admin),
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
    if len(users) != len(data.user_ids):
        raise HTTPException(status_code=400, detail="One or more users not found or inactive")

    grants = []
    for user in users:
        # Create grant record
        grant = RewardGrant(
            reward_id=reward.id,
            user_id=user.id,
            reward_name=reward.name,
            amount=reward.amount,
            note=data.note,
            granted_by_scheduler=False,
        )
        db.add(grant)

        # Update user balance (auto-approved)
        user.balance += reward.amount

        grants.append(grant)

    db.commit()

    # Send notifications
    for grant in grants:
        db.refresh(grant)
        send_event_message(
            db,
            "reward_granted",
            grant.user,
            {
                "user": grant.user.first_name,
                "reward_name": reward.name,
                "amount": f"{reward.amount:.2f}",
            },
        )

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
