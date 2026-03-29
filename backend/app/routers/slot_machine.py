import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc, func

from app.auth.telegram import require_active_user, require_admin
from app.database import get_db
from app.models.app_setting import AppSetting
from app.models.fiscal_period import FiscalPeriod
from app.models.slot_machine_spin import SlotMachineSpin
from app.models.user import User
from app.schemas.slot_machine import (
    SlotMachineAdminStats,
    SlotMachineHistory,
    SlotMachineSpinRequest,
    SlotMachineSpinResponse,
    SlotMachineStats,
    SlotMachineStatusResponse,
    SlotMachineToggleRequest,
    SlotMachineTopWinner,
)
from app.services.slot_machine import SlotMachineService

router = APIRouter()


def _is_slot_machine_enabled(db: Session) -> bool:
    setting = db.query(AppSetting).filter(AppSetting.key == "slot_machine_enabled").first()
    if not setting:
        return True
    return setting.value == "true"


@router.get("/slot-machine/status", response_model=SlotMachineStatusResponse)
def get_slot_machine_status(
    _user: User = Depends(require_active_user),
    db: Session = Depends(get_db),
):
    return SlotMachineStatusResponse(enabled=_is_slot_machine_enabled(db))


@router.post("/slot-machine/spin", response_model=SlotMachineSpinResponse)
def spin_slot_machine(
    data: SlotMachineSpinRequest,
    user: User = Depends(require_active_user),
    db: Session = Depends(get_db),
):
    """
    Spin the slot machine.

    - Deducts 1€ from user balance
    - Spins the slot machine
    - Adds win amount (if any) to user balance
    - Records the spin in history
    """
    # Check if slot machine is enabled
    if not _is_slot_machine_enabled(db):
        raise HTTPException(
            status_code=403,
            detail="Slot machine is currently disabled."
        )

    bet_amount = SlotMachineService.BET_AMOUNT
    BLACKLIST_LIMIT = -50.0

    # Check if user has reached blacklist limit (-50€)
    if user.balance < -49:
        raise HTTPException(
            status_code=400,
            detail=f"You have reached the blacklist limit ({BLACKLIST_LIMIT:.2f}€). Cannot gamble further!"
        )

    # Deduct bet amount
    user.balance -= bet_amount

    # Spin the slot machine
    symbols, win_amount = SlotMachineService.spin(bet_amount)

    # Add win amount to balance
    user.balance += win_amount

    # Record the spin
    spin_record = SlotMachineSpin(
        user_id=user.id,
        bet_amount=bet_amount,
        win_amount=win_amount,
        symbols=json.dumps(symbols),
    )
    db.add(spin_record)

    # Commit all changes
    db.commit()
    db.refresh(user)

    return SlotMachineSpinResponse(
        symbols=symbols,
        win_amount=win_amount,
        bet_amount=bet_amount,
        new_balance=user.balance,
    )


@router.get("/slot-machine/history", response_model=list[SlotMachineHistory])
def get_slot_machine_history(
    user: User = Depends(require_active_user),
    db: Session = Depends(get_db),
    limit: int = 50,
):
    """
    Get user's slot machine history.

    Returns up to `limit` most recent spins.
    """
    spins = (
        db.query(SlotMachineSpin)
        .filter(SlotMachineSpin.user_id == user.id)
        .order_by(desc(SlotMachineSpin.created_at))
        .limit(limit)
        .all()
    )

    return [
        SlotMachineHistory(
            id=spin.id,
            user_id=spin.user_id,
            bet_amount=spin.bet_amount,
            win_amount=spin.win_amount,
            symbols=json.loads(spin.symbols),
            created_at=spin.created_at,
        )
        for spin in spins
    ]


@router.get("/slot-machine/stats", response_model=SlotMachineStats)
def get_slot_machine_stats(
    user: User = Depends(require_active_user),
    db: Session = Depends(get_db),
):
    """
    Get user's slot machine statistics.

    Returns:
    - Total spins
    - Total bet amount
    - Total won amount
    - Net result (won - bet)
    - Biggest single win
    """
    stats = (
        db.query(
            func.count(SlotMachineSpin.id).label("total_spins"),
            func.sum(SlotMachineSpin.bet_amount).label("total_bet"),
            func.sum(SlotMachineSpin.win_amount).label("total_won"),
            func.max(SlotMachineSpin.win_amount).label("biggest_win"),
        )
        .filter(SlotMachineSpin.user_id == user.id)
        .first()
    )

    total_spins = stats.total_spins or 0
    total_bet = stats.total_bet or 0.0
    total_won = stats.total_won or 0.0
    biggest_win = stats.biggest_win or 0.0

    return SlotMachineStats(
        total_spins=total_spins,
        total_bet=total_bet,
        total_won=total_won,
        net_result=total_won - total_bet,
        biggest_win=biggest_win,
    )


@router.get("/slot-machine/admin/stats", response_model=SlotMachineAdminStats)
def get_admin_slot_machine_stats(
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Get global slot machine statistics scoped to current fiscal period."""
    # Get current fiscal period
    current_period = db.query(FiscalPeriod).filter(FiscalPeriod.ended_at.is_(None)).first()

    period_start = current_period.started_at if current_period else None
    period_end = None

    # Base query filter for fiscal period
    period_filter = []
    if period_start:
        period_filter.append(SlotMachineSpin.created_at >= period_start)

    # Global stats
    stats = (
        db.query(
            func.count(SlotMachineSpin.id).label("total_spins"),
            func.coalesce(func.sum(SlotMachineSpin.bet_amount), 0.0).label("total_bet"),
            func.coalesce(func.sum(SlotMachineSpin.win_amount), 0.0).label("total_won"),
        )
        .filter(*period_filter)
        .first()
    )

    total_spins = stats.total_spins or 0
    total_bet = float(stats.total_bet or 0)
    total_won = float(stats.total_won or 0)
    house_profit = total_bet - total_won
    actual_rtp = (total_won / total_bet * 100) if total_bet > 0 else 0.0
    theoretical_rtp = SlotMachineService.get_theoretical_rtp()

    # Top winners by net result (won - bet)
    top_winners_query = (
        db.query(
            SlotMachineSpin.user_id,
            User.first_name.label("user_name"),
            func.count(SlotMachineSpin.id).label("total_spins"),
            func.sum(SlotMachineSpin.bet_amount).label("total_bet"),
            func.sum(SlotMachineSpin.win_amount).label("total_won"),
        )
        .join(User, SlotMachineSpin.user_id == User.id)
        .filter(*period_filter)
        .group_by(SlotMachineSpin.user_id, User.first_name)
        .order_by((func.sum(SlotMachineSpin.win_amount) - func.sum(SlotMachineSpin.bet_amount)).desc())
        .limit(10)
        .all()
    )

    top_winners = [
        SlotMachineTopWinner(
            user_id=w.user_id,
            user_name=w.user_name,
            total_spins=w.total_spins,
            total_bet=float(w.total_bet),
            total_won=float(w.total_won),
            net_result=float(w.total_won) - float(w.total_bet),
        )
        for w in top_winners_query
    ]

    enabled = _is_slot_machine_enabled(db)

    return SlotMachineAdminStats(
        total_spins=total_spins,
        total_bet=total_bet,
        total_won=total_won,
        house_profit=house_profit,
        actual_rtp=actual_rtp,
        theoretical_rtp=theoretical_rtp,
        top_winners=top_winners,
        period_start=period_start,
        period_end=period_end,
        enabled=enabled,
    )


@router.put("/slot-machine/admin/toggle", response_model=SlotMachineStatusResponse)
def toggle_slot_machine(
    data: SlotMachineToggleRequest,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Enable or disable the slot machine."""
    setting = db.query(AppSetting).filter(AppSetting.key == "slot_machine_enabled").first()
    if not setting:
        setting = AppSetting(
            key="slot_machine_enabled",
            value="true" if data.enabled else "false",
        )
        db.add(setting)
    else:
        setting.value = "true" if data.enabled else "false"
        setting.updated_at = datetime.now(timezone.utc)

    db.commit()
    return SlotMachineStatusResponse(enabled=data.enabled)
