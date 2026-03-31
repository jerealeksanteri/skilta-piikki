import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc, func

from app.auth.telegram import require_active_user, require_admin
from app.database import get_db
from app.models.app_setting import AppSetting
from app.models.fiscal_period import FiscalPeriod
from app.models.roulette_spin import RouletteSpin
from app.models.user import User
from app.schemas.roulette import (
    RouletteAdminStats,
    RouletteBetResult,
    RouletteHistory,
    RouletteSpinRequest,
    RouletteSpinResponse,
    RouletteStats,
    RouletteStatusResponse,
    RouletteToggleRequest,
    RouletteTopWinner,
)
from app.services.roulette_machine import RouletteBetType, RouletteService

router = APIRouter()

VALID_BET_TYPES = {bt.value for bt in RouletteBetType}


def _is_roulette_enabled(db: Session) -> bool:
    setting = db.query(AppSetting).filter(AppSetting.key == "roulette_enabled").first()
    if not setting:
        return True
    return setting.value == "true"


@router.get("/roulette/status", response_model=RouletteStatusResponse)
def get_roulette_status(
    _user: User = Depends(require_active_user),
    db: Session = Depends(get_db),
):
    return RouletteStatusResponse(enabled=_is_roulette_enabled(db))


@router.post("/roulette/spin", response_model=RouletteSpinResponse)
def spin_roulette(
    data: RouletteSpinRequest,
    user: User = Depends(require_active_user),
    db: Session = Depends(get_db),
):
    if not _is_roulette_enabled(db):
        raise HTTPException(status_code=403, detail="Roulette is currently disabled.")

    if not data.bets:
        raise HTTPException(status_code=400, detail="At least one bet is required.")

    BLACKLIST_LIMIT = -50.0
    if user.balance < -49:
        raise HTTPException(
            status_code=400,
            detail=f"You have reached the blacklist limit ({BLACKLIST_LIMIT:.2f}\u20ac). Cannot gamble further!",
        )

    # Validate all bets before spinning
    for bet in data.bets:
        if bet.bet_type not in VALID_BET_TYPES:
            raise HTTPException(status_code=400, detail=f"Invalid bet type: '{bet.bet_type}'")
        if bet.amount <= 0:
            raise HTTPException(status_code=400, detail="Bet amount must be positive.")

    total_bet = sum(b.amount for b in data.bets)
    total_bet = round(total_bet, 2)

    # Deduct total bet
    user.balance -= total_bet

    # Spin the wheel once
    number, color = RouletteService.spin()

    # Calculate payout for each bet
    results: list[RouletteBetResult] = []
    total_win = 0.0

    for bet in data.bets:
        bet_type_enum = RouletteBetType(bet.bet_type)
        try:
            payout = RouletteService.calculate_payout(
                bet_type_enum, bet.bet_value, (number, color), bet.amount
            )
        except ValueError as e:
            # Refund total bet on validation error and raise
            user.balance += total_bet
            raise HTTPException(status_code=400, detail=str(e))

        total_win += payout
        results.append(RouletteBetResult(
            bet_type=bet.bet_type,
            bet_value=bet.bet_value,
            amount=bet.amount,
            payout=payout,
        ))

    total_win = round(total_win, 2)

    # Add winnings
    user.balance += total_win

    # Record the spin
    spin_record = RouletteSpin(
        user_id=user.id,
        bet_amount=total_bet,
        win_amount=total_win,
        bet_data=json.dumps([r.model_dump() for r in results]),
        result_number=number,
        result_color=color,
    )
    db.add(spin_record)
    db.commit()
    db.refresh(user)

    return RouletteSpinResponse(
        number=number,
        color=color,
        results=results,
        total_bet=total_bet,
        total_win=total_win,
        new_balance=user.balance,
    )


@router.get("/roulette/history", response_model=list[RouletteHistory])
def get_roulette_history(
    user: User = Depends(require_active_user),
    db: Session = Depends(get_db),
    limit: int = 50,
):
    spins = (
        db.query(RouletteSpin)
        .filter(RouletteSpin.user_id == user.id)
        .order_by(desc(RouletteSpin.created_at))
        .limit(limit)
        .all()
    )

    return [
        RouletteHistory(
            id=spin.id,
            user_id=spin.user_id,
            bet_amount=spin.bet_amount,
            win_amount=spin.win_amount,
            bet_data=json.loads(spin.bet_data),
            result_number=spin.result_number,
            result_color=spin.result_color,
            created_at=spin.created_at,
        )
        for spin in spins
    ]


@router.get("/roulette/stats", response_model=RouletteStats)
def get_roulette_stats(
    user: User = Depends(require_active_user),
    db: Session = Depends(get_db),
):
    stats = (
        db.query(
            func.count(RouletteSpin.id).label("total_spins"),
            func.sum(RouletteSpin.bet_amount).label("total_bet"),
            func.sum(RouletteSpin.win_amount).label("total_won"),
            func.max(RouletteSpin.win_amount).label("biggest_win"),
        )
        .filter(RouletteSpin.user_id == user.id)
        .first()
    )

    total_spins = stats.total_spins or 0
    total_bet = stats.total_bet or 0.0
    total_won = stats.total_won or 0.0
    biggest_win = stats.biggest_win or 0.0

    return RouletteStats(
        total_spins=total_spins,
        total_bet=total_bet,
        total_won=total_won,
        net_result=total_won - total_bet,
        biggest_win=biggest_win,
    )


@router.get("/roulette/admin/stats", response_model=RouletteAdminStats)
def get_admin_roulette_stats(
    scope: str = "fiscal_period",
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    current_period = db.query(FiscalPeriod).filter(FiscalPeriod.ended_at.is_(None)).first()
    period_start = current_period.started_at if current_period and scope == "fiscal_period" else None
    period_end = None

    period_filter = []
    if scope == "fiscal_period" and period_start:
        period_filter.append(RouletteSpin.created_at >= period_start)

    stats = (
        db.query(
            func.count(RouletteSpin.id).label("total_spins"),
            func.coalesce(func.sum(RouletteSpin.bet_amount), 0.0).label("total_bet"),
            func.coalesce(func.sum(RouletteSpin.win_amount), 0.0).label("total_won"),
        )
        .filter(*period_filter)
        .first()
    )

    total_spins = stats.total_spins or 0
    total_bet = float(stats.total_bet or 0)
    total_won = float(stats.total_won or 0)
    house_profit = total_bet - total_won
    actual_rtp = (total_won / total_bet * 100) if total_bet > 0 else 0.0
    theoretical_rtp = RouletteService.get_theoretical_rtp()

    top_winners_query = (
        db.query(
            RouletteSpin.user_id,
            User.first_name.label("user_name"),
            func.count(RouletteSpin.id).label("total_spins"),
            func.sum(RouletteSpin.bet_amount).label("total_bet"),
            func.sum(RouletteSpin.win_amount).label("total_won"),
        )
        .join(User, RouletteSpin.user_id == User.id)
        .filter(*period_filter)
        .group_by(RouletteSpin.user_id, User.first_name)
        .order_by((func.sum(RouletteSpin.win_amount) - func.sum(RouletteSpin.bet_amount)).desc())
        .limit(10)
        .all()
    )

    top_winners = [
        RouletteTopWinner(
            user_id=w.user_id,
            user_name=w.user_name,
            total_spins=w.total_spins,
            total_bet=float(w.total_bet),
            total_won=float(w.total_won),
            net_result=float(w.total_won) - float(w.total_bet),
        )
        for w in top_winners_query
    ]

    enabled = _is_roulette_enabled(db)

    return RouletteAdminStats(
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


@router.put("/roulette/admin/toggle", response_model=RouletteStatusResponse)
def toggle_roulette(
    data: RouletteToggleRequest,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    setting = db.query(AppSetting).filter(AppSetting.key == "roulette_enabled").first()
    if not setting:
        setting = AppSetting(
            key="roulette_enabled",
            value="true" if data.enabled else "false",
        )
        db.add(setting)
    else:
        setting.value = "true" if data.enabled else "false"
        setting.updated_at = datetime.now(timezone.utc)

    db.commit()
    return RouletteStatusResponse(enabled=data.enabled)
