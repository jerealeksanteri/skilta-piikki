import json
from datetime import datetime

from sqlalchemy.orm import Session

from app.models.reward import Reward
from app.models.reward_grant import RewardGrant
from app.models.transaction import Transaction
from app.models.user import User
from app.services.balance import adjust_balance
from app.services.messaging import send_bulk_event_message


class RewardService:
    @staticmethod
    def target_users(db: Session, reward: Reward) -> list[User]:
        """Active users the reward applies to (an empty assignment means everyone)."""
        query = db.query(User).filter(User.is_active == True)  # noqa: E712
        assigned_ids = json.loads(reward.assigned_user_ids)
        if assigned_ids:
            query = query.filter(User.id.in_(assigned_ids))
        return query.order_by(User.id).all()

    @staticmethod
    def grant(
        db: Session,
        reward: Reward,
        users: list[User],
        *,
        granted_by_scheduler: bool,
        scheduled_for: datetime | None = None,
        note: str | None = None,
        created_by_id: int | None = None,
    ) -> list[RewardGrant]:
        """Credit the reward to each user. Does not commit.

        Each grant gets an approved ``reward`` transaction so it shows up in the
        user's history, and the balance is changed atomically. For scheduled
        grants, users who already received this occurrence are skipped, so
        re-running an occurrence can never pay twice.
        """
        if scheduled_for is not None:
            already = {
                user_id
                for (user_id,) in db.query(RewardGrant.user_id).filter(
                    RewardGrant.reward_id == reward.id,
                    RewardGrant.scheduled_for == scheduled_for,
                )
            }
            users = [u for u in users if u.id not in already]

        tx_note = f"{reward.name} — {note}" if note else reward.name
        grants = []
        for user in users:
            tx = Transaction(
                user_id=user.id,
                type="reward",
                amount=reward.amount,
                status="approved",
                created_by_id=created_by_id,
                note=tx_note,
            )
            grant = RewardGrant(
                reward_id=reward.id,
                user_id=user.id,
                reward_name=reward.name,
                amount=reward.amount,
                note=note,
                granted_by_scheduler=granted_by_scheduler,
                scheduled_for=scheduled_for,
                transaction=tx,
            )
            db.add_all([tx, grant])
            adjust_balance(db, user, reward.amount)
            grants.append(grant)
        return grants

    @staticmethod
    def notify(db: Session, grants: list[RewardGrant]) -> None:
        """Send the reward_granted message. Call only after the grants are committed."""
        send_bulk_event_message(
            db,
            "reward_granted",
            [
                (
                    g.user,
                    {
                        "user": g.user.first_name,
                        "reward_name": g.reward_name,
                        "amount": f"{g.amount:.2f}",
                    },
                )
                for g in grants
            ],
        )
