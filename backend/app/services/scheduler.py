import json
import logging
from datetime import datetime, timezone, timedelta
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

from app.database import SessionLocal
from app.models.reward import Reward
from app.models.reward_grant import RewardGrant
from app.models.user import User
from app.services.messaging import send_event_message

logger = logging.getLogger(__name__)

scheduler = BackgroundScheduler()


def _calculate_next_grant_date(frequency: str, current_date: datetime) -> datetime:
    """Calculate next grant date based on frequency"""
    if frequency == "daily":
        return current_date + timedelta(days=1)
    elif frequency == "weekly":
        return current_date + timedelta(weeks=1)
    elif frequency == "monthly":
        # More accurate monthly calculation
        if current_date.month == 12:
            return current_date.replace(year=current_date.year + 1, month=1)
        else:
            return current_date.replace(month=current_date.month + 1)
    elif frequency == "yearly":
        return current_date.replace(year=current_date.year + 1)
    raise ValueError(f"Invalid frequency: {frequency}")


def process_recurring_rewards():
    """
    Background job to process recurring rewards.
    Runs every hour to check for rewards that need to be granted.
    """
    logger.info("Starting recurring rewards processing...")
    db = SessionLocal()
    try:
        now = datetime.now(timezone.utc)

        # Find all active recurring rewards that are due
        due_rewards = (
            db.query(Reward)
            .filter(
                Reward.is_active == True,
                Reward.reward_type == "recurring",
                Reward.next_grant_date <= now,
            )
            .all()
        )

        logger.info(f"Found {len(due_rewards)} due rewards")

        for reward in due_rewards:
            try:
                # Determine target users
                assigned_ids = json.loads(reward.assigned_user_ids)
                if assigned_ids:
                    # Specific users
                    target_users = (
                        db.query(User)
                        .filter(User.id.in_(assigned_ids), User.is_active == True)
                        .all()
                    )
                else:
                    # All active users
                    target_users = db.query(User).filter(User.is_active == True).all()

                logger.info(f"Granting reward '{reward.name}' to {len(target_users)} users")

                # Grant to each user
                for user in target_users:
                    # Create grant record
                    grant = RewardGrant(
                        reward_id=reward.id,
                        user_id=user.id,
                        reward_name=reward.name,
                        amount=reward.amount,
                        granted_by_scheduler=True,
                    )
                    db.add(grant)

                    # Update user balance (auto-approved)
                    user.balance += reward.amount

                    # Send notification
                    send_event_message(
                        db,
                        "reward_granted",
                        user,
                        {
                            "user": user.first_name,
                            "reward_name": reward.name,
                            "amount": f"{reward.amount:.2f}",
                        },
                    )

                # Update next grant date
                reward.next_grant_date = _calculate_next_grant_date(
                    reward.recurrence_frequency,
                    now,
                )

                db.commit()
                logger.info(f"Successfully granted reward '{reward.name}'. Next grant: {reward.next_grant_date}")

            except Exception as e:
                logger.error(f"Error processing reward {reward.id}: {e}", exc_info=True)
                db.rollback()
                continue

        logger.info("Recurring rewards processing completed")

    except Exception as e:
        logger.error(f"Fatal error in recurring rewards processing: {e}", exc_info=True)
    finally:
        db.close()


def start_scheduler():
    """Start the background scheduler"""
    # Run every hour at minute 0
    scheduler.add_job(
        process_recurring_rewards,
        CronTrigger(minute=0),  # Every hour on the hour
        id="process_recurring_rewards",
        replace_existing=True,
        misfire_grace_time=300,  # 5 minutes grace period
    )

    scheduler.start()
    logger.info("Reward scheduler started")


def stop_scheduler():
    """Stop the background scheduler"""
    scheduler.shutdown()
    logger.info("Reward scheduler stopped")
