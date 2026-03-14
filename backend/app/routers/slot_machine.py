import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc, func

from app.auth.telegram import require_active_user
from app.database import get_db
from app.models.slot_machine_spin import SlotMachineSpin
from app.models.user import User
from app.schemas.slot_machine import (
    SlotMachineSpinRequest,
    SlotMachineSpinResponse,
    SlotMachineHistory,
    SlotMachineStats,
)
from app.services.slot_machine import SlotMachineService

router = APIRouter()


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
    bet_amount = SlotMachineService.BET_AMOUNT

    # Check if user has enough balance
    if user.balance < bet_amount:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient balance. You need at least {bet_amount:.2f}€ to play."
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
