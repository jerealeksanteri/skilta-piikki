import json
import logging
from datetime import datetime, timezone

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

from app.database import SessionLocal
from app.models.app_setting import AppSetting
from app.models.reward import Reward
from app.services.reward_schedule import next_occurrence_after, utcnow
from app.services.rewards import RewardService

logger = logging.getLogger(__name__)

scheduler = BackgroundScheduler(timezone="UTC")

JOB_ID = "process_recurring_rewards"
LAST_RUN_KEY = "reward_scheduler_last_run"


def _due(query, now):
    return query.filter(
        Reward.is_active == True,  # noqa: E712
        Reward.reward_type == "recurring",
        Reward.next_grant_date <= now,
    )


def _process_reward(reward_id: int, now) -> int:
    """Grant every due occurrence of one reward. Returns how many were granted.

    Each occurrence is its own transaction: lock the reward row, grant, advance
    ``next_grant_date``, commit, and only then notify. ``SKIP LOCKED`` means
    that if another process (a second worker or replica) is already handling
    this reward, we leave it alone instead of paying it out twice.
    """
    db = SessionLocal()
    processed = 0
    try:
        while True:
            reward = (
                _due(db.query(Reward), now)
                .filter(Reward.id == reward_id)
                .with_for_update(skip_locked=True)
                .first()
            )
            if reward is None:
                return processed

            scheduled_for = reward.next_grant_date
            anchor = reward.schedule_anchor or scheduled_for
            users = RewardService.target_users(db, reward)
            grants = RewardService.grant(
                db,
                reward,
                users,
                granted_by_scheduler=True,
                scheduled_for=scheduled_for,
            )
            reward.schedule_anchor = anchor
            reward.next_grant_date = next_occurrence_after(
                anchor, reward.recurrence_frequency, scheduled_for
            )
            db.commit()
            processed += 1
            logger.info(
                "Granted reward %s (%s) for %s to %d users; next %s",
                reward_id, reward.name, scheduled_for, len(grants), reward.next_grant_date,
            )

            try:
                RewardService.notify(db, grants)
            except Exception:
                # The grant is already committed; a failed message must not undo it.
                logger.exception("Failed to send reward notifications for reward %s", reward_id)
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def process_recurring_rewards():
    """Background job: grant all recurring rewards that are due.

    Missed occurrences (e.g. the server was down) are granted on the next run,
    one per occurrence.
    """
    now = utcnow()
    db = SessionLocal()
    try:
        due_ids = [reward_id for (reward_id,) in _due(db.query(Reward.id), now).all()]
    except Exception:
        logger.exception("Could not load due rewards")
        return
    finally:
        db.close()

    if due_ids:
        logger.info("Processing %d due recurring rewards", len(due_ids))
    granted = 0
    failed: list[int] = []
    for reward_id in due_ids:
        try:
            granted += _process_reward(reward_id, now)
        except Exception:
            # Rolled back; nothing was granted or sent. Retried on the next run.
            failed.append(reward_id)
            logger.exception("Error processing reward %s", reward_id)

    _record_run(due_rewards=len(due_ids), occurrences_granted=granted, failed_reward_ids=failed)


def _record_run(**summary) -> None:
    """Store a summary of this run for the admin status view.

    If the database can't even be read, nothing is recorded, and the status
    view shows the scheduler as stale.
    """
    db = SessionLocal()
    try:
        value = json.dumps({"finished_at": utcnow().isoformat(), **summary})
        setting = db.get(AppSetting, LAST_RUN_KEY)
        if setting is None:
            db.add(AppSetting(key=LAST_RUN_KEY, value=value))
        else:
            setting.value = value
            setting.updated_at = datetime.now(timezone.utc)
        db.commit()
    except Exception:
        db.rollback()
        logger.exception("Could not record reward scheduler run")
    finally:
        db.close()


def read_last_run(db) -> dict | None:
    """The summary stored by the most recent run, or None if it never ran."""
    setting = db.get(AppSetting, LAST_RUN_KEY)
    if setting is None:
        return None
    data = json.loads(setting.value)
    data["finished_at"] = datetime.fromisoformat(data["finished_at"])
    return data


def next_run_at() -> datetime | None:
    """When this process will next run the job (None if not scheduled here)."""
    job = scheduler.get_job(JOB_ID) if scheduler.running else None
    if job is None or job.next_run_time is None:
        return None
    return job.next_run_time.astimezone(timezone.utc).replace(tzinfo=None)


def start_scheduler():
    """Start the background scheduler"""
    scheduler.add_job(
        process_recurring_rewards,
        CronTrigger(minute=0),  # Every hour on the hour
        id=JOB_ID,
        replace_existing=True,
        misfire_grace_time=300,  # 5 minutes grace period
        coalesce=True,
        max_instances=1,
    )

    scheduler.start()
    logger.info("Reward scheduler started")


def stop_scheduler():
    """Stop the background scheduler"""
    scheduler.shutdown()
    logger.info("Reward scheduler stopped")
